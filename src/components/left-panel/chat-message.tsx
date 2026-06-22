import type { ChatMessage } from "@/lib/types";

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

  if (message.type === "reasoning") {
    return (
      <div className="mb-2.5 flex w-fit cursor-pointer items-center gap-1.5 text-sm text-[#666] hover:text-[#999]">
        Reasoning
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    );
  }

  if (message.type === "classified") {
    return (
      <p className="mb-3 text-[15px] leading-relaxed text-[#f0f0f0]">
        {message.content}
      </p>
    );
  }

  if (message.type === "result") {
    return (
      <div className="mb-3">
        <p className="mb-2 text-[15px] leading-relaxed text-[#f0f0f0]">
          {message.content}
        </p>
        {message.stateNames && (
          <ul className="list-disc space-y-1.5 pl-5">
            {message.stateNames.map((name) => (
              <li key={name} className="text-[15px] text-[#f0f0f0]">
                <strong className="font-semibold">
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (message.type === "error") {
    return (
      <p className="mb-3 text-[15px] leading-relaxed text-[#f87171]">
        {message.content}
      </p>
    );
  }

  return (
    <p className="mb-3 text-[15px] leading-relaxed text-[#f0f0f0]">
      {message.content}
    </p>
  );
}
