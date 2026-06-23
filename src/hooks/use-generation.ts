"use client";

import { useState, useRef, useCallback } from "react";
import type { ChatMessage, Scenario, Session, LayoutDescription, SSEEvent, StateOutput } from "@/lib/types";

interface UseGenerationReturn {
  messages: ChatMessage[];
  isGenerating: boolean;
  generate: (
    screenName: string,
    components: string[],
    onSession: (session: Session) => void,
  ) => Promise<void>;
  refine: (
    session: Session,
    instruction: string,
    onSession: (session: Session) => void,
  ) => Promise<void>;
  abort: () => void;
  clearMessages: () => void;
}

function makeMsg(
  role: ChatMessage["role"],
  content: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return { id: crypto.randomUUID(), role, content, timestamp: Date.now(), ...extra };
}

/** Parse an SSE fetch response body as an async generator of events. */
async function* readSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        yield JSON.parse(line.slice(6)) as SSEEvent;
      } catch {
        // skip malformed chunk
      }
    }
  }
}

export function useGeneration(): UseGenerationReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const push = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const update = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const generate = useCallback(
    async (
      screenName: string,
      components: string[],
      onSession: (session: Session) => void,
    ): Promise<void> => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);

      push(makeMsg("user", screenName));

      // ── Phase 1: Classify ─────────────────────────────────────────────────
      const classifyThinking = makeMsg("ai", "", {
        type: "thinking",
        phase: "Classifying your screen…",
        detail: "Analysing the screen name to determine its archetype, component layout, and which UI states a real user would encounter.",
      });
      push(classifyThinking);

      try {
        const classifyRes = await fetch("/api/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ screenName, components }),
          signal: controller.signal,
        });
        if (!classifyRes.ok) throw new Error("classify failed");
        const { archetypes, scenarios, layoutDescription } = (await classifyRes.json()) as {
          archetypes: string[];
          scenarios: Scenario[];
          layoutDescription: LayoutDescription;
        };

        update(classifyThinking.id, { isComplete: true });

        push(
          makeMsg("ai", `Classified as ${archetypes.join(", ")} — ${scenarios.length} scenarios planned.`, {
            type: "classified",
          }),
        );

        // ── Phase 2: Stream generation ────────────────────────────────────
        const generateThinking = makeMsg("ai", "", {
          type: "thinking",
          phase: `Generating ${scenarios.length} scenarios…`,
          detail: `Building the prototype first, then adapting all ${scenarios.length} states in parallel: ${scenarios.map((s) => s.name).join(" · ")}.`,
        });
        push(generateThinking);

        const generateRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenarios, layoutDescription, archetypes }),
          signal: controller.signal,
        });
        if (!generateRes.ok || !generateRes.body) throw new Error("generate failed");

        // Build session skeleton immediately after classify so the session
        // appears in history before any states arrive.
        const sessionId = crypto.randomUUID();
        const skeleton: Session = {
          id: sessionId,
          screenName,
          components,
          archetypes,
          layoutDescription,
          scenarios,
          states: {},
          activeState: scenarios[0]?.name ?? "prototype",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const states: Record<string, StateOutput> = {};
        let readyCount = 0;

        for await (const event of readSSE(generateRes.body.getReader())) {
          if (event.type === "state") {
            states[event.name] = { jsx: event.jsx, description: event.description };
            readyCount++;

            // Progressive update — emit session after each arriving state so
            // the canvas renders without waiting for all states to complete.
            onSession({ ...skeleton, states: { ...states }, updatedAt: Date.now() });

            update(generateThinking.id, {
              phase: `Generating… ${readyCount} / ${scenarios.length} ready`,
            });
          } else if (event.type === "state_error") {
            console.warn(`[generate] state "${event.name}" failed:`, event.message);
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "done") {
            break;
          }
        }

        update(generateThinking.id, { isComplete: true });

        push(
          makeMsg("ai", `${readyCount} scenarios ready — switch between them using the dropdown above.`, {
            type: "result",
            stateNames: scenarios.map((s) => s.name),
          }),
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        push(makeMsg("ai", "Generation failed. Please try again.", { type: "error" }));
      } finally {
        setIsGenerating(false);
      }
    },
    [push, update],
  );

  const refine = useCallback(
    async (
      session: Session,
      instruction: string,
      onSession: (session: Session) => void,
    ): Promise<void> => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);

      push(makeMsg("user", instruction));

      const thinkingMsg = makeMsg("ai", "", {
        type: "thinking",
        phase: "Applying your change…",
        detail: `Patching the prototype with your instruction, then re-adapting all ${session.scenarios.length} states in parallel.`,
      });
      push(thinkingMsg);

      try {
        const protoScenario = session.scenarios[0];
        const currentPrototypeJsx = protoScenario
          ? (session.states[protoScenario.name]?.jsx ?? null)
          : null;

        const generateRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarios: session.scenarios,
            layoutDescription: session.layoutDescription,
            userInstruction: instruction,
            ...(currentPrototypeJsx ? { currentPrototypeJsx } : {}),
          }),
          signal: controller.signal,
        });
        if (!generateRes.ok || !generateRes.body) throw new Error("generate failed");

        const states: Record<string, StateOutput> = {};
        let readyCount = 0;

        for await (const event of readSSE(generateRes.body.getReader())) {
          if (event.type === "state") {
            states[event.name] = { jsx: event.jsx, description: event.description };
            readyCount++;

            onSession({ ...session, states: { ...states }, updatedAt: Date.now() });

            update(thinkingMsg.id, {
              phase: `Applying change… ${readyCount} / ${session.scenarios.length} ready`,
            });
          } else if (event.type === "state_error") {
            console.warn(`[refine] state "${event.name}" failed:`, event.message);
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "done") {
            break;
          }
        }

        update(thinkingMsg.id, { isComplete: true });
        push(
          makeMsg("ai", `Done — ${readyCount} scenarios updated.`, {
            type: "result",
            stateNames: session.scenarios.map((s) => s.name),
          }),
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        update(thinkingMsg.id, { isComplete: true });
        push(makeMsg("ai", "Refinement failed.", { type: "error" }));
      } finally {
        setIsGenerating(false);
      }
    },
    [push, update],
  );

  return { messages, isGenerating, generate, refine, abort, clearMessages };
}
