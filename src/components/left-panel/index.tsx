import type { ChatMessage } from "@/lib/types";
import LeftHeader from "./left-header";
import ChatWindow from "./chat-window";
import ChatInput from "./chat-input";

interface LeftPanelProps {
  screenName: string | null;
  messages: ChatMessage[];
  isGenerating: boolean;
  hasSession: boolean;
  onHistoryClick: () => void;
  onNewSession: () => void;
  onSend: (value: string) => void;
  onAbort: () => void;
}

export default function LeftPanel({
  screenName,
  messages,
  isGenerating,
  hasSession,
  onHistoryClick,
  onNewSession,
  onSend,
  onAbort,
}: LeftPanelProps) {
  return (
    <div className="flex w-[360px] flex-shrink-0 flex-col overflow-hidden border-r border-[#222] bg-[#111]">
      <LeftHeader
        screenName={screenName}
        onHistoryClick={onHistoryClick}
        onNewSession={onNewSession}
      />
      <ChatWindow messages={messages} />
      <ChatInput
        isGenerating={isGenerating}
        hasSession={hasSession}
        onSend={onSend}
        onAbort={onAbort}
      />
    </div>
  );
}
