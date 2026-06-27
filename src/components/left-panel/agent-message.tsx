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

// ─── Reasoning (collapsible, prompt-kit style) ────────────────────────────────

function ReasoningBlock({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current || !innerRef.current) return;
    if (open) {
      contentRef.current.style.maxHeight = `${innerRef.current.scrollHeight}px`;
    } else {
      contentRef.current.style.maxHeight = "0px";
    }
  }, [open, text]);

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", padding: 0,
          cursor: "pointer", color: "#666",
        }}
      >
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#666" }}>
          {isStreaming && !open ? <span className="text-shimmer">Reasoning…</span> : "Reasoning"}
        </span>
      </button>

      <div
        ref={contentRef}
        style={{ overflow: "hidden", maxHeight: 0, transition: "max-height 0.25s ease-out" }}
      >
        <div
          ref={innerRef}
          style={{ borderRadius: 8, border: "1px solid #2e2e2e", background: "#1a1a1a", padding: "10px 13px", marginTop: 6 }}
        >
          {isStreaming ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div className="shimmer-bar" style={{ height: 9, width: "82%" }} />
              <div className="shimmer-bar" style={{ height: 9, width: "60%" }} />
              <div className="shimmer-bar" style={{ height: 9, width: "74%" }} />
            </div>
          ) : (
            <p style={{ fontSize: 11, color: "#555", lineHeight: 1.65, margin: 0 }}>{text}</p>
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
      <span className="text-shimmer" style={{ fontSize: 13, fontWeight: 500 }}>
        Classifying &ldquo;{screenName}&rdquo;&hellip;
      </span>
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
      <span className="text-shimmer" style={{ fontSize: 13, fontWeight: 500 }}>
        {isRefine ? "Applying change" : "Generating Blade JSX"}&hellip;{" "}
        {statesReady > 0 && `${statesReady}/${total} ready`}
      </span>
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
    const textPart = message.parts?.find((p) => p.type === "text") as AnyPart | undefined;
    const fileParts = (message.parts ?? []).filter(
      (p) => p.type === "file",
    ) as Array<{ type: "file"; url: string; mediaType?: string }>;
    const text = textPart?.text ?? "";

    return (
      <div className="mb-5 flex flex-col items-end gap-2">
        {fileParts.map((fp, idx) =>
          fp.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={idx}
              src={fp.url}
              alt="Attached Figma frame"
              className="max-h-[180px] max-w-[240px] rounded-lg border border-[#3C3C3C] object-contain"
            />
          ) : null,
        )}
        {text && (
          <div className="flex items-start justify-end gap-2.5">
            <span className="pt-1 text-right text-[15px] leading-snug text-[#f0f0f0]">
              {text}
            </span>
            <div className="mt-0.5 flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-[13px] font-bold text-white">
              K
            </div>
          </div>
        )}
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

        if (part.type === "tool-analyze_image") {
          const isDone = part.state === "output-available";
          const isError = part.state === "output-error";
          if (isError) {
            return (
              <p key={i} style={{ fontSize: 13, color: "#f87171", margin: "5px 0 8px" }}>
                Image analysis failed.
              </p>
            );
          }
          if (isDone) {
            const output = part.output as { screenName?: string; heading?: string } | undefined;
            return (
              <p
                key={i}
                style={{ fontSize: 13, color: "#666", lineHeight: 1.5, margin: "5px 0 8px", paddingLeft: 2 }}
              >
                <TypewriterText
                  text={`Analyzed "${output?.screenName ?? "screen"}" — ${output?.heading ?? "details extracted"}.`}
                  speed={10}
                />
              </p>
            );
          }
          return (
            <div key={i} style={{ marginBottom: 10 }}>
              <span className="text-shimmer" style={{ fontSize: 13, fontWeight: 500 }}>
                Analyzing image…
              </span>
            </div>
          );
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
