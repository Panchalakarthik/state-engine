import type { Session } from "./types";

export async function getSessions(): Promise<Session[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("/api/sessions", { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function saveSession(session: Session): Promise<Session[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function deleteSession(id: string): Promise<Session[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`/api/sessions/${id}`, {
      method: "DELETE",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function updateSessionState(id: string, activeState: string): Promise<Session[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeState }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
