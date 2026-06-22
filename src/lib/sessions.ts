import type { Session } from "./types";

const STORAGE_KEY = "state-engine-sessions";
const MAX_SESSIONS = 20;

export function getSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: Session): Session[] {
  const sessions = getSessions();
  const existingIndex = sessions.findIndex((s) => s.id === session.id);

  const updated =
    existingIndex >= 0
      ? sessions.map((s) => (s.id === session.id ? session : s))
      : [session, ...sessions].slice(0, MAX_SESSIONS);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteSession(id: string): Session[] {
  const updated = getSessions().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function updateSessionState(id: string, activeState: string): Session[] {
  const updated = getSessions().map((s) =>
    s.id === id ? { ...s, activeState, updatedAt: Date.now() } : s,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
