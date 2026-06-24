"use client";

import { useState, useRef, KeyboardEvent } from "react";

interface ChatInputProps {
  isGenerating: boolean;
  hasSession: boolean;
  onSend: (value: string) => void;
  onAbort: () => void;
  disabled?: boolean;
}

export default function ChatInput({
  isGenerating,
  hasSession,
  onSend,
  onAbort,
  disabled,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex-shrink-0 bg-[#262626] px-3 pb-3 pt-2">
      <div
        className={`flex min-h-[120px] flex-col gap-5 rounded-[14px] border bg-[#262626] px-3.5 pb-3 pt-4 transition-colors duration-150 ${
          focused ? "border-[#7c3aed]" : "border-[#3C3C3C]"
        }`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={hasSession ? "Ask for a change" : "Name a screen…"}
          rows={2}
          disabled={disabled}
          className="flex-1 resize-none border-none bg-transparent text-[16px] leading-relaxed text-[#ccc] outline-none placeholder:text-[#BBBAB0]"
        />
        <div className="flex items-center justify-between">
          <button className="text-[20px] leading-none text-[#555] transition-colors hover:text-[#aaa]">
            +
          </button>
          {isGenerating ? (
            <button
              onClick={onAbort}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7c3aed] transition-colors hover:bg-[#6d28d9]"
              title="Stop generation"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                <rect x="1" y="1" width="10" height="10" rx="1.5" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7c3aed] transition-colors hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-40"
              title="Send"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
