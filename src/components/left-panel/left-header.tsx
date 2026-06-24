"use client";

interface LeftHeaderProps {
  screenName: string | null;
  onHistoryClick: () => void;
  onNewSession: () => void;
}

export default function LeftHeader({
  screenName,
  onHistoryClick,
  onNewSession,
}: LeftHeaderProps) {
  return (
    <div className="flex h-[46px] flex-shrink-0 items-center gap-2 border-b border-[#1e1e1e] px-4">
      <span className="flex-1 truncate text-sm font-medium text-[#f0f0f0]">
        {screenName ?? "State Engine"}
      </span>
      <button
        onClick={onHistoryClick}
        className="flex h-7 w-7 items-center justify-center rounded-md text-white transition-colors hover:bg-[#1e1e1e] hover:text-white"
        title="History"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>
      <button
        onClick={onNewSession}
        className="flex h-7 w-7 items-center justify-center rounded-md text-white transition-colors hover:bg-[#1e1e1e] hover:text-white"
        title="New session"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
