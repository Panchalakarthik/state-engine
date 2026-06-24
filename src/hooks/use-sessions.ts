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
  persistSession: (session: Session) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  setActiveState: (sessionId: string, stateName: string) => Promise<void>;
  startNewSession: () => void;
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    getSessions().then(setSessions);
  }, []);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? null;

  const persistSession = useCallback(async (session: Session) => {
    const updated = await saveSession(session);
    setSessions(updated);
    setActiveSessionId(session.id);
  }, []);

  const removeSession = useCallback(
    async (id: string) => {
      const updated = await deleteSession(id);
      setSessions(updated);
      if (activeSessionId === id) {
        setActiveSessionId(updated[0]?.id ?? null);
      }
    },
    [activeSessionId],
  );

  const setActiveState = useCallback(async (sessionId: string, stateName: string) => {
    const updated = await updateSessionState(sessionId, stateName);
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
