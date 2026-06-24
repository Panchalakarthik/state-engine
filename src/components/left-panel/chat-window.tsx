"use client";

import { useEffect, useRef } from "react";
import type { AppUIMessage } from "@/lib/ai-types";
import AgentMessage from "./agent-message";

interface ChatWindowProps {
  messages: AppUIMessage[];
  isStreaming: boolean;
  statesReadyCount: number;
  isStopped: boolean;
}

export default function ChatWindow({ messages, isStreaming, statesReadyCount, isStopped }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="text-sm leading-relaxed text-[#444]">
          Name a screen (e.g. &ldquo;Sales Dashboard&rdquo;) and press Enter.
          <br />
          I&rsquo;ll classify it and derive every state.
        </p>
      </div>
    );
  }

  const lastAssistantIdx = messages.reduce(
    (acc, m, i) => (m.role === "assistant" ? i : acc),
    -1,
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-3 pt-5">
      {messages.map((msg, i) => (
        <AgentMessage
          key={msg.id}
          message={msg}
          isLastAssistant={i === lastAssistantIdx}
          isStreaming={isStreaming}
          statesReadyCount={statesReadyCount}
          isStopped={isStopped}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
