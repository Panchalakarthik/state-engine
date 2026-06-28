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
    // Optimistically update local state immediately so canvas renders
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === session.id);
      return idx >= 0
        ? prev.map((s) => (s.id === session.id ? session : s))
        : [session, ...prev];
    });
    setActiveSessionId(session.id);
    // Persist to DB in background — if it fails, local state is already correct
    const updated = await saveSession(session);
    if (updated.length > 0) setSessions(updated);
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
    // Optimistic update — switch canvas immediately without waiting for DB
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, activeState: stateName } : s)),
    );
    // Persist to DB in background — if it fails, local state stays correct
    const updated = await updateSessionState(sessionId, stateName);
    if (updated.length > 0) setSessions(updated);
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
