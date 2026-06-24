import type { Session } from "./types";

export async function getSessions(): Promise<Session[]> {
  const res = await fetch("/api/sessions");
  if (!res.ok) return [];
  return res.json();
}

export async function saveSession(session: Session): Promise<Session[]> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function deleteSession(id: string): Promise<Session[]> {
  const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) return [];
  return res.json();
}

export async function updateSessionState(id: string, activeState: string): Promise<Session[]> {
  const res = await fetch(`/api/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeState }),
  });
  if (!res.ok) return [];
  return res.json();
}
