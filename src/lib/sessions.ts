import type { Session } from "./types";

const STORAGE_KEY = "state-engine-sessions";
const MAX_SESSIONS = 10; // keep fewer sessions to stay well under localStorage 5 MB limit

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

  persistToStorage(updated);
  return updated;
}

export function deleteSession(id: string): Session[] {
  const updated = getSessions().filter((s) => s.id !== id);
  persistToStorage(updated);
  return updated;
}

export function updateSessionState(id: string, activeState: string): Session[] {
  const updated = getSessions().map((s) =>
    s.id === id ? { ...s, activeState, updatedAt: Date.now() } : s,
  );
  persistToStorage(updated);
  return updated;
}

/** Write to localStorage with graceful fallback on QuotaExceededError. */
function persistToStorage(sessions: Session[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage full — evict oldest half and retry once
    const trimmed = sessions.slice(0, Math.max(1, Math.floor(sessions.length / 2)));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Last resort: clear everything and keep only the newest session
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 1)));
      } catch {
        // Give up silently — the UI still works, just won't persist
      }
    }
  }
}
