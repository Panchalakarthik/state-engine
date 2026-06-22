"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import ChatMessageItem from "./chat-message";

interface ChatWindowProps {
  messages: ChatMessage[];
}

export default function ChatWindow({ messages }: ChatWindowProps) {
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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-3 pt-5">
      {messages.map((msg) => (
        <ChatMessageItem key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
