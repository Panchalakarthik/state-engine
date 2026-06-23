"use client";

import { useState } from "react";
import type { ResponsiveMode, Scenario } from "@/lib/types";
import StateDropdown from "@/components/state-dropdown";

interface RightHeaderProps {
  scenarios: Scenario[];
  activeState: string;
  responsiveMode: ResponsiveMode;
  onResponsiveChange: (mode: ResponsiveMode) => void;
  onStateChange: (state: string) => void;
  onExport: () => void;
}

const responsiveModes: {
  mode: ResponsiveMode;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    mode: "desktop",
    label: "Desktop",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    mode: "tablet",
    label: "Tablet",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    mode: "mobile",
    label: "Mobile",
    icon: (
      <svg
        width="12"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
      </svg>
    ),
  },
];

export default function RightHeader({
  scenarios,
  activeState,
  responsiveMode,
  onResponsiveChange,
  onStateChange,
  onExport,
}: RightHeaderProps) {
  const [copied, setCopied] = useState(false);

  function handleExport() {
    onExport();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-[46px] flex-shrink-0 items-center gap-2 border-b border-[#1a1a1a] bg-[#111] px-3.5">
      <div className="flex flex-1 items-center gap-2">
        <StateDropdown
          scenarios={scenarios}
          activeState={activeState}
          onChange={onStateChange}
        />
        <div className="flex items-center overflow-hidden rounded-[7px] border border-[#2a2a2a] bg-[#1a1a1a]">
          {responsiveModes.map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => onResponsiveChange(mode)}
              title={label}
              className={`flex h-[30px] w-8 items-center justify-center border-r border-[#2a2a2a] transition-colors last:border-r-0 ${
                responsiveMode === mode
                  ? "bg-[#1e1e2e] text-[#818cf8]"
                  : "text-[#555] hover:bg-[#222] hover:text-[#bbb]"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          title="Coming soon"
          className="flex cursor-not-allowed items-center gap-1.5 rounded-[7px] border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-[5px] text-[12px] text-[#666]"
        >
          <FigmaIcon />
          Copy to Figma
        </button>
        <button
          onClick={handleExport}
          disabled={scenarios.length === 0}
          className="flex items-center gap-1.5 rounded-[7px] border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-[5px] text-[12px] text-[#bbb] transition-colors hover:bg-[#202020] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {copied ? "Copied!" : "Export Code"}
        </button>
      </div>
    </div>
  );
}

function FigmaIcon() {
  return (
    <svg
      viewBox="0 0 14 20"
      width="11"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.5 20C5.43 20 7 18.43 7 16.5V13H3.5C1.57 13 0 14.57 0 16.5C0 18.43 1.57 20 3.5 20Z"
        fill="#0ACF83"
      />
      <path
        d="M0 10C0 8.07 1.57 6.5 3.5 6.5H7V13.5H3.5C1.57 13.5 0 11.93 0 10Z"
        fill="#A259FF"
      />
      <path
        d="M0 3.5C0 1.57 1.57 0 3.5 0H7V7H3.5C1.57 7 0 5.43 0 3.5Z"
        fill="#F24E1E"
      />
      <path
        d="M7 0H10.5C12.43 0 14 1.57 14 3.5C14 5.43 12.43 7 10.5 7H7V0Z"
        fill="#FF7262"
      />
      <path
        d="M14 10C14 11.93 12.43 13.5 10.5 13.5C8.57 13.5 7 11.93 7 10C7 8.07 8.57 6.5 10.5 6.5C12.43 6.5 14 8.07 14 10Z"
        fill="#1ABCFE"
      />
    </svg>
  );
}
