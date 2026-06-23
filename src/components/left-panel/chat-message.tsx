"use client";

import { useState, useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

// ─── Typewriter ────────────────────────────────────────────────────────────────

function TypewriterText({
  text,
  speed = 14,
  onComplete,
}: {
  text: string;
  speed?: number;
  onComplete?: () => void;
}) {
  const [displayed, setDisplayed] = useState("");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!text) {
      onCompleteRef.current?.();
      return;
    }
    let idx = 0;
    const iv = setInterval(() => {
      idx++;
      setDisplayed(text.slice(0, idx));
      if (idx >= text.length) {
        clearInterval(iv);
        onCompleteRef.current?.();
      }
    }, speed);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

  return <>{displayed}</>;
}

// ─── Thinking / Reasoning bubble ───────────────────────────────────────────────

function ThinkingMessage({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(false); // always starts closed

  return (
    <div style={{ marginBottom: 6 }}>
      {/* Header row — always says "Reasoning" */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: message.isComplete ? "#555" : "#888",
          transition: "color 0.15s",
        }}
      >
        {/* Status dot / checkmark */}
        {message.isComplete ? (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#555"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <span
            className="pulse-dot"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#7c3aed",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
        )}

        <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.01em" }}>
          Reasoning
        </span>

        {/* Chevron */}
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Expandable body */}
      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? 220 : 0,
          transition: "max-height 0.3s ease",
        }}
      >
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #1e1e1e",
            background: "#141414",
            padding: "11px 14px",
            marginTop: 7,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {message.isComplete ? (
            /* Done state */
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#444"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontSize: 12, color: "#555" }}>Done</span>
            </div>
          ) : (
            /* Active state: phase label + detail + shimmer lines */
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "#999", lineHeight: 1.4 }}
                >
                  {message.phase}
                </span>
                {message.detail && (
                  <span style={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>
                    {message.detail}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 2 }}>
                <div className="shimmer-bar" style={{ height: 10, width: "80%" }} />
                <div className="shimmer-bar" style={{ height: 10, width: "58%" }} />
                <div className="shimmer-bar" style={{ height: 10, width: "71%" }} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Classified message (between the two reasoning blocks) ─────────────────────

function ClassifiedMessage({ message }: { message: ChatMessage }) {
  return (
    <p
      style={{
        fontSize: 13,
        color: "#666",
        lineHeight: 1.5,
        margin: "5px 0 8px",
        paddingLeft: 2,
      }}
    >
      <TypewriterText text={message.content} speed={10} />
    </p>
  );
}

// ─── Result message (final, with staggered pills) ──────────────────────────────

function ResultMessage({ message }: { message: ChatMessage }) {
  const [textDone, setTextDone] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const names = message.stateNames ?? [];

  useEffect(() => {
    if (!textDone || names.length === 0) return;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= names.length) clearInterval(iv);
    }, 170);
    return () => clearInterval(iv);
  }, [textDone, names.length]);

  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#f0f0f0", marginBottom: 10 }}>
        <TypewriterText text={message.content} speed={12} onComplete={() => setTextDone(true)} />
      </p>
      {names.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {names.slice(0, visibleCount).map((name) => (
            <span
              key={name}
              className="pill-in"
              style={{
                fontSize: 12,
                color: "#aaa",
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: 999,
                padding: "3px 10px",
              }}
            >
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

interface ChatMessageProps {
  message: ChatMessage;
}

export default function ChatMessageItem({ message }: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className="mb-5 flex items-start justify-end gap-2.5">
        <span className="pt-1 text-right text-[15px] leading-snug text-[#f0f0f0]">
          {message.content}
        </span>
        <div className="mt-0.5 flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-[13px] font-bold text-white">
          K
        </div>
      </div>
    );
  }

  if (message.type === "thinking") {
    return <ThinkingMessage message={message} />;
  }

  if (message.type === "classified") {
    return <ClassifiedMessage message={message} />;
  }

  if (message.type === "result") {
    return <ResultMessage message={message} />;
  }

  if (message.type === "error") {
    return (
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#f87171", marginBottom: 12 }}>
        {message.content}
      </p>
    );
  }

  // fallback
  return (
    <p className="mb-3 text-[15px] leading-relaxed text-[#f0f0f0]">
      {message.content}
    </p>
  );
}
