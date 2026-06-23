"use client";

import { useState, useRef, useEffect } from "react";
import type { Scenario } from "@/lib/types";

interface StateDropdownProps {
  scenarios: Scenario[];
  activeState: string;
  onChange: (state: string) => void;
}

function toLabel(name: string) {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function StateDropdown({
  scenarios,
  activeState,
  onChange,
}: StateDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (scenarios.length === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-[7px] border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1 text-[12.5px] text-[#555]">
        <div className="h-1.5 w-1.5 rounded-full bg-[#333]" />
        No scenarios yet
      </div>
    );
  }

  const active = scenarios.find((s) => s.name === activeState) ?? scenarios[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-[7px] border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1 text-[12.5px] text-[#ccc] transition-colors hover:bg-[#202020]"
      >
        <div className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
        {toLabel(active.name)}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#666"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] shadow-xl">
          {scenarios.map((scenario) => (
            <button
              key={scenario.name}
              onClick={() => {
                onChange(scenario.name);
                setOpen(false);
              }}
              className={`w-full px-3 py-2.5 text-left transition-colors ${
                scenario.name === activeState
                  ? "bg-[#1e1e2e] text-[#818cf8]"
                  : "text-[#ccc] hover:bg-[#222]"
              }`}
            >
              <div className="text-[13px] font-medium">{toLabel(scenario.name)}</div>
              <div className="mt-0.5 text-[11px] text-[#555] leading-snug">
                {scenario.description}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
