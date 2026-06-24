"use client";

import { useState, useEffect, useRef } from "react";
import type { AppUIMessage } from "@/lib/ai-types";

// ─── Typewriter ───────────────────────────────────────────────────────────────

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
    if (!text) { onCompleteRef.current?.(); return; }
    let idx = 0;
    const iv = setInterval(() => {
      idx++;
      setDisplayed(text.slice(0, idx));
      if (idx >= text.length) { clearInterval(iv); onCompleteRef.current?.(); }
    }, speed);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{displayed}</>;
}

// ─── Reasoning (collapsible) ──────────────────────────────────────────────────

function ReasoningBlock({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginBottom: 6 }}>
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
          color: isStreaming ? "#888" : "#555",
          transition: "color 0.15s",
        }}
      >
        {isStreaming ? (
          <span
            className="pulse-dot"
            style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed", display: "inline-block", flexShrink: 0 }}
          />
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span style={{ fontSize: 12, fontWeight: 500 }}>Reasoning</span>
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      <div style={{ overflow: "hidden", maxHeight: open ? 240 : 0, transition: "max-height 0.3s ease" }}>
        <div style={{ borderRadius: 10, border: "1px solid #1e1e1e", background: "#141414", padding: "11px 14px", marginTop: 7 }}>
          {isStreaming ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div className="shimmer-bar" style={{ height: 10, width: "80%" }} />
              <div className="shimmer-bar" style={{ height: 10, width: "58%" }} />
              <div className="shimmer-bar" style={{ height: 10, width: "71%" }} />
            </div>
          ) : (
            <p style={{ fontSize: 11, color: "#555", lineHeight: 1.6, margin: 0 }}>{text}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pulse indicator ──────────────────────────────────────────────────────────

function PulseDot() {
  return (
    <span
      className="pulse-dot"
      style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed", display: "inline-block", flexShrink: 0 }}
    />
  );
}

// ─── Tool: classify_screen ────────────────────────────────────────────────────

type AnyPart = {
  type: string;
  state?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  text?: string;
};

function ClassifyStep({ part }: { part: AnyPart }) {
  const isDone = part.state === "output-available";
  const isError = part.state === "output-error";
  const screenName = (part.input?.screenName as string | undefined) ?? "screen";
  const output = part.output as { archetypes?: string[]; scenarios?: { name: string }[] } | undefined;

  if (isError) {
    return <p style={{ fontSize: 13, color: "#f87171", margin: "5px 0 8px" }}>Classification failed.</p>;
  }

  if (isDone && output) {
    const archetypes = output.archetypes ?? [];
    const count = output.scenarios?.length ?? 0;
    return (
      <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5, margin: "5px 0 8px", paddingLeft: 2 }}>
        <TypewriterText
          text={`Classified as ${archetypes.join(", ")} — ${count} scenario${count !== 1 ? "s" : ""} planned.`}
          speed={10}
        />
      </p>
    );
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
        <PulseDot />
        <span style={{ fontSize: 12, color: "#777" }}>Classifying &ldquo;{screenName}&rdquo;&hellip;</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingLeft: 2 }}>
        <div className="shimmer-bar" style={{ height: 9, width: "72%" }} />
        <div className="shimmer-bar" style={{ height: 9, width: "48%" }} />
      </div>
    </div>
  );
}

// ─── Tool: generate_states (done state) ──────────────────────────────────────

function GenerateDone({ names }: { names: string[] }) {
  const [textDone, setTextDone] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!textDone || names.length === 0) return;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= names.length) clearInterval(iv);
    }, 150);
    return () => clearInterval(iv);
  }, [textDone, names.length]);

  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#f0f0f0", marginBottom: 10 }}>
        <TypewriterText
          text={`${names.length} scenario${names.length !== 1 ? "s" : ""} ready — switch using the dropdown above.`}
          speed={12}
          onComplete={() => setTextDone(true)}
        />
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

function GenerateStep({ part, statesReady, isStopped }: { part: AnyPart; statesReady: number; isStopped: boolean }) {
  const isDone = part.state === "output-available";
  const isError = part.state === "output-error";
  const input = part.input as { scenarios?: { name: string }[]; instruction?: string } | undefined;
  const output = part.output as { stateNames?: string[] } | undefined;
  const total = input?.scenarios?.length ?? 0;
  const isRefine = Boolean(input?.instruction);

  if (isError) {
    return <p style={{ fontSize: 13, color: "#f87171", margin: "5px 0 8px" }}>Generation failed.</p>;
  }

  if (isDone && output) {
    return <GenerateDone names={output.stateNames ?? []} />;
  }

  if (isStopped) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="#555">
            <rect x="1" y="1" width="10" height="10" rx="1.5" />
          </svg>
          <span style={{ fontSize: 12, color: "#555" }}>
            Stopped —{" "}
            {statesReady > 0
              ? `${statesReady} of ${total} scenario${total !== 1 ? "s" : ""} ready`
              : "no scenarios ready yet"}
          </span>
        </div>
        {statesReady > 0 && (
          <p style={{ fontSize: 12, color: "#444", paddingLeft: 2, margin: 0 }}>
            Switch scenarios using the dropdown above, or send a new message to regenerate.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
        <PulseDot />
        <span style={{ fontSize: 12, color: "#777" }}>
          {isRefine ? "Applying change" : "Generating Blade JSX"}&hellip;{" "}
          {statesReady > 0 && <span style={{ color: "#555" }}>{statesReady}/{total} ready</span>}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingLeft: 2 }}>
        <div className="shimmer-bar" style={{ height: 9, width: "85%" }} />
        <div className="shimmer-bar" style={{ height: 9, width: "62%" }} />
        <div className="shimmer-bar" style={{ height: 9, width: "78%" }} />
        <div className="shimmer-bar" style={{ height: 9, width: "54%" }} />
      </div>
    </div>
  );
}

// ─── Message renderer ─────────────────────────────────────────────────────────

interface AgentMessageProps {
  message: AppUIMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
  statesReadyCount: number;
  isStopped: boolean;
}

export default function AgentMessage({
  message,
  isLastAssistant,
  isStreaming,
  statesReadyCount,
  isStopped,
}: AgentMessageProps) {
  if (message.role === "user") {
    const text = message.parts?.find((p) => p.type === "text")?.text ?? "";
    return (
      <div className="mb-5 flex items-start justify-end gap-2.5">
        <span className="pt-1 text-right text-[15px] leading-snug text-[#f0f0f0]">{text}</span>
        <div className="mt-0.5 flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-[13px] font-bold text-white">
          K
        </div>
      </div>
    );
  }

  const parts = (message.parts ?? []) as AnyPart[];
  let reasoningIdx = 0;

  return (
    <div className="mb-4">
      {parts.map((part, i) => {
        if (part.type === "step-start" || part.type === "data-state") return null;

        if (part.type === "reasoning") {
          const idx = reasoningIdx++;
          const streaming = isLastAssistant && isStreaming && part.state === "streaming";
          return <ReasoningBlock key={`r-${idx}`} text={part.text ?? ""} isStreaming={streaming} />;
        }

        if (part.type === "tool-classify_screen") {
          return <ClassifyStep key={i} part={part} />;
        }

        if (part.type === "tool-generate_states") {
          return <GenerateStep key={i} part={part} statesReady={statesReadyCount} isStopped={isLastAssistant && isStopped} />;
        }

        if (part.type === "text" && part.text) {
          return (
            <p key={i} style={{ fontSize: 15, lineHeight: 1.6, color: "#f0f0f0", marginBottom: 12 }}>
              {part.text}
            </p>
          );
        }

        return null;
      })}
    </div>
  );
}
