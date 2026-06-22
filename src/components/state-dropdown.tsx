"use client";

import { useState, useRef, useEffect } from "react";

interface StateDropdownProps {
  states: string[];
  activeState: string;
  onChange: (state: string) => void;
}

export default function StateDropdown({
  states,
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

  if (states.length === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-[7px] border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1 text-[12.5px] text-[#555]">
        <div className="h-1.5 w-1.5 rounded-full bg-[#333]" />
        No states yet
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-[7px] border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1 text-[12.5px] text-[#ccc] transition-colors hover:bg-[#202020]"
      >
        <div className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
        State: {activeState.charAt(0).toUpperCase() + activeState.slice(1)}
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
        <div className="absolute left-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] shadow-xl">
          {states.map((state) => (
            <button
              key={state}
              onClick={() => {
                onChange(state);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-[13px] transition-colors ${
                state === activeState
                  ? "bg-[#1e1e2e] text-[#818cf8]"
                  : "text-[#ccc] hover:bg-[#222]"
              }`}
            >
              {state.charAt(0).toUpperCase() + state.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
