"use client";

import { useState, useRef, useCallback } from "react";
import type { ChatMessage, Scenario, Session, LayoutDescription } from "@/lib/types";

interface UseGenerationReturn {
  messages: ChatMessage[];
  isGenerating: boolean;
  generate: (screenName: string, components: string[]) => Promise<Session | null>;
  refine: (session: Session, instruction: string) => Promise<Session | null>;
  abort: () => void;
  clearMessages: () => void;
}

function makeMsg(
  role: ChatMessage["role"],
  content: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    ...extra,
  };
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
    ): Promise<Session | null> => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);

      push(makeMsg("user", screenName));

      // ── Phase 1: Classify ────────────────────────────────────────────────
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

        const scenarioNames = scenarios.map((s) => s.name);

        update(classifyThinking.id, { isComplete: true });

        // Typed confirmation between the two reasoning blocks
        push(
          makeMsg(
            "ai",
            `Classified as ${archetypes.join(", ")} — ${scenarioNames.length} scenarios planned.`,
            { type: "classified" },
          ),
        );

        // ── Phase 2: Generate ──────────────────────────────────────────────
        const generateThinking = makeMsg("ai", "", {
          type: "thinking",
          phase: `Generating ${scenarioNames.length} scenarios…`,
          detail: `Building the prototype first, then adapting it into ${scenarioNames.length} distinct states: ${scenarioNames.join(" · ")}.`,
        });
        push(generateThinking);

        const generateRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenarios, layoutDescription }),
          signal: controller.signal,
        });
        if (!generateRes.ok) throw new Error("generate failed");
        const { states } = await generateRes.json();

        const session: Session = {
          id: crypto.randomUUID(),
          screenName,
          components,
          archetypes,
          scenarios,
          layoutDescription,
          states,
          activeState: scenarios[0]?.name ?? "loading",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        update(generateThinking.id, { isComplete: true });

        push(
          makeMsg(
            "ai",
            `${scenarioNames.length} scenarios ready — switch between them using the dropdown above.`,
            { type: "result", stateNames: scenarioNames },
          ),
        );

        return session;
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        push(
          makeMsg("ai", "Generation failed. Please try again.", { type: "error" }),
        );
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [push, update],
  );

  const refine = useCallback(
    async (session: Session, instruction: string): Promise<Session | null> => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);

      push(makeMsg("user", instruction));

      const thinkingMsg = makeMsg("ai", "", {
        type: "thinking",
        phase: "Applying your change…",
        detail: `Regenerating all ${session.scenarios.length} scenarios with your instruction applied to the prototype, then re-adapting each state.`,
      });
      push(thinkingMsg);

      try {
        const generateRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarios: session.scenarios,
            layoutDescription: session.layoutDescription,
            userInstruction: instruction,
          }),
          signal: controller.signal,
        });
        if (!generateRes.ok) throw new Error("generate failed");
        const { states } = await generateRes.json();

        const updated: Session = { ...session, states, updatedAt: Date.now() };

        update(thinkingMsg.id, { isComplete: true });

        push(
          makeMsg("ai", `Done — ${session.scenarios.length} scenarios updated.`, {
            type: "result",
            stateNames: session.scenarios.map((s) => s.name),
          }),
        );

        return updated;
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        update(thinkingMsg.id, { isComplete: true });
        push(makeMsg("ai", "Refinement failed.", { type: "error" }));
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [push, update],
  );

  return { messages, isGenerating, generate, refine, abort, clearMessages };
}
