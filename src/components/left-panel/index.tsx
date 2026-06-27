import type { AppUIMessage } from "@/lib/ai-types";
import LeftHeader from "./left-header";
import ChatWindow from "./chat-window";
import ChatInput from "./chat-input";

interface LeftPanelProps {
  screenName: string | null;
  messages: AppUIMessage[];
  isGenerating: boolean;
  hasSession: boolean;
  statesReadyCount: number;
  isStopped: boolean;
  limitReached: boolean;
  usageLoading: boolean;
  onHistoryClick: () => void;
  onNewSession: () => void;
  onSend: (value: string, imageFile?: File) => void;
  onAbort: () => void;
}

export default function LeftPanel({
  screenName,
  messages,
  isGenerating,
  hasSession,
  statesReadyCount,
  isStopped,
  limitReached,
  usageLoading,
  onHistoryClick,
  onNewSession,
  onSend,
  onAbort,
}: LeftPanelProps) {
  return (
    <div className="flex w-[360px] flex-shrink-0 flex-col overflow-hidden border-r border-[#3C3C3C] bg-[#262626]">
      <LeftHeader
        screenName={screenName}
        onHistoryClick={onHistoryClick}
        onNewSession={onNewSession}
      />
      <ChatWindow
        messages={messages}
        isStreaming={isGenerating}
        statesReadyCount={statesReadyCount}
        isStopped={isStopped}
      />
      {limitReached ? (
        <div className="flex-shrink-0 bg-[#262626] px-3 pb-3 pt-2">
          <div className="flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-[14px] border border-[#3C3C3C]">
            <p className="text-sm font-medium text-[#ccc]">Question limit reached</p>
            <p className="text-xs text-[#5F5F5F]">You've used all 3 questions.</p>
          </div>
        </div>
      ) : (
        <ChatInput
          isGenerating={isGenerating}
          hasSession={hasSession}
          onSend={onSend}
          onAbort={onAbort}
          disabled={usageLoading}
        />
      )}
    </div>
  );
}
