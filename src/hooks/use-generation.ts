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
      push(makeMsg("ai", `Classifying ${screenName}...`, { type: "reasoning" }));

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
        push(
          makeMsg(
            "ai",
            `Classified as ${archetypes.join(", ")}. Generating ${scenarioNames.length} scenarios: ${scenarioNames.join(", ")}...`,
            { type: "classified" },
          ),
        );

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

        push(
          makeMsg(
            "ai",
            `${scenarioNames.length} scenarios ready: ${scenarioNames.join(" · ")}`,
            { type: "result", stateNames: scenarioNames },
          ),
        );

        return session;
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        push(
          makeMsg("ai", "Generation failed. Please try again.", {
            type: "error",
          }),
        );
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [push],
  );

  const refine = useCallback(
    async (session: Session, instruction: string): Promise<Session | null> => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);

      push(makeMsg("user", instruction));
      push(makeMsg("ai", "Applying your change...", { type: "reasoning" }));

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

        const updated: Session = {
          ...session,
          states,
          updatedAt: Date.now(),
        };

        push(
          makeMsg("ai", `Done. ${session.scenarios.length} scenarios updated.`, {
            type: "result",
            stateNames: session.scenarios.map((s) => s.name),
          }),
        );

        return updated;
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        push(makeMsg("ai", "Refinement failed.", { type: "error" }));
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [push],
  );

  return { messages, isGenerating, generate, refine, abort, clearMessages };
}
