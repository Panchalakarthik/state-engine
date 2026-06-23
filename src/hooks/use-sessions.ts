"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getSessions,
  saveSession,
  deleteSession,
  updateSessionState,
} from "@/lib/sessions";
import type { Session } from "@/lib/types";

interface UseSessionsReturn {
  sessions: Session[];
  activeSession: Session | null;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  persistSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setActiveState: (sessionId: string, stateName: string) => void;
  startNewSession: () => void;
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    const stored = getSessions();
    setSessions(stored);
    // Don't auto-activate last session — start with blank canvas.
    // User can pick a session from History.
  }, []);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? null;

  const persistSession = useCallback((session: Session) => {
    const updated = saveSession(session);
    setSessions(updated);
    setActiveSessionId(session.id);
  }, []);

  const removeSession = useCallback(
    (id: string) => {
      const updated = deleteSession(id);
      setSessions(updated);
      if (activeSessionId === id) {
        setActiveSessionId(updated[0]?.id ?? null);
      }
    },
    [activeSessionId],
  );

  const setActiveState = useCallback((sessionId: string, stateName: string) => {
    const updated = updateSessionState(sessionId, stateName);
    setSessions(updated);
  }, []);

  const startNewSession = useCallback(() => {
    setActiveSessionId(null);
  }, []);

  return {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    persistSession,
    removeSession,
    setActiveState,
    startNewSession,
  };
}
