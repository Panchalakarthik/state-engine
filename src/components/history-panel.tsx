"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@/lib/types";

interface HistoryPanelProps {
  open: boolean;
  sessions: Session[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function HistoryPanel({
  open,
  sessions,
  activeSessionId,
  onSelect,
  onClose,
}: HistoryPanelProps) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = sessions.filter((s) =>
    s.screenName.toLowerCase().includes(query.toLowerCase()),
  );

  function formatDate(ts: number) {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return d.toLocaleDateString("en-GB");
  }

  return (
    <div
      ref={ref}
      className="absolute left-2 top-[54px] z-50 w-[320px] overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-[#222] px-3.5 py-2.5">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#555"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Sessions"
          autoFocus
          className="flex-1 border-none bg-transparent text-[13px] text-[#ccc] outline-none placeholder:text-[#555]"
        />
      </div>
      <p className="px-3.5 pb-1 pt-2.5 text-[11px] text-[#555]">Recents</p>
      <div className="max-h-72 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3.5 py-3 text-[13px] text-[#444]">
            No sessions found
          </p>
        ) : (
          filtered.map((session) => (
            <button
              key={session.id}
              onClick={() => {
                onSelect(session.id);
                onClose();
              }}
              className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] transition-colors ${
                session.id === activeSessionId
                  ? "bg-[#1e1e2e] text-[#a5b4fc]"
                  : "text-[#ddd] hover:bg-[#222]"
              }`}
            >
              <span className="truncate">{session.screenName}</span>
              <span className="ml-2 flex-shrink-0 text-[11px] text-[#555]">
                {formatDate(session.createdAt)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
