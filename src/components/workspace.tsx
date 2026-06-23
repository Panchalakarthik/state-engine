"use client";

import { useState, useCallback } from "react";
import LeftPanel from "./left-panel";
import RightPanel from "./right-panel";
import HistoryPanel from "./history-panel";
import { useGeneration } from "@/hooks/use-generation";
import { useSessions } from "@/hooks/use-sessions";

const DEFAULT_COMPONENTS: string[] = [];

export default function Workspace() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { messages, isGenerating, generate, refine, abort, clearMessages } = useGeneration();
  const {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    persistSession,
    setActiveState,
    startNewSession,
  } = useSessions();

  const handleSend = useCallback(
    async (value: string) => {
      if (activeSession) {
        await refine(activeSession, value, (updated) => persistSession(updated));
      } else {
        await generate(value, DEFAULT_COMPONENTS, (session) => persistSession(session));
      }
    },
    [activeSession, generate, refine, persistSession],
  );

  const handleStateChange = useCallback(
    (stateName: string) => {
      if (!activeSessionId) return;
      setActiveState(activeSessionId, stateName);
    },
    [activeSessionId, setActiveState],
  );

  const handleNewSession = useCallback(() => {
    startNewSession();
    clearMessages();
  }, [startNewSession, clearMessages]);

  const handleExport = useCallback(() => {
    if (!activeSession) return;
    const jsx = activeSession.states[activeSession.activeState]?.jsx ?? "";
    const screenName = activeSession.screenName.replace(/\s+/g, "-").toLowerCase();
    const filename = `${screenName}-${activeSession.activeState}.tsx`;
    const blob = new Blob([jsx], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [activeSession]);

  return (
    <div className="relative flex h-screen overflow-hidden">
      <LeftPanel
        screenName={activeSession?.screenName ?? null}
        messages={messages}
        isGenerating={isGenerating}
        hasSession={Boolean(activeSession)}
        onHistoryClick={() => setHistoryOpen((o) => !o)}
        onNewSession={handleNewSession}
        onSend={handleSend}
        onAbort={abort}
      />
      <RightPanel
        scenarios={activeSession?.scenarios ?? []}
        states={activeSession?.states ?? {}}
        activeState={activeSession?.activeState ?? ""}
        isGenerating={isGenerating}
        onStateChange={handleStateChange}
        onExport={handleExport}
      />
      <HistoryPanel
        open={historyOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={(id) => {
          setActiveSessionId(id);
          clearMessages();
        }}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
