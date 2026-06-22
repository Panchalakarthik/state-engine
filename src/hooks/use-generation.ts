"use client";

import { useState, useRef, useCallback } from "react";
import type { ChatMessage, Session, LayoutDescription } from "@/lib/types";

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
        const { archetypes, layoutDescription } = (await classifyRes.json()) as {
          archetypes: string[];
          layoutDescription: LayoutDescription;
        };

        push(
          makeMsg(
            "ai",
            `Classified as ${archetypes.join(", ")}. Generating states in parallel...`,
            { type: "classified" },
          ),
        );

        const generateRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archetypes, layoutDescription }),
          signal: controller.signal,
        });
        if (!generateRes.ok) throw new Error("generate failed");
        const { states } = await generateRes.json();
        const stateNames = Object.keys(states);

        const session: Session = {
          id: crypto.randomUUID(),
          screenName,
          components,
          archetypes,
          layoutDescription,
          states,
          activeState: "default",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        push(
          makeMsg(
            "ai",
            `${stateNames.length} states ready. Layout is locked across all states.`,
            { type: "result", stateNames },
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
            archetypes: session.archetypes,
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
          makeMsg("ai", "Done. States updated with your change.", {
            type: "result",
            stateNames: Object.keys(states),
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
