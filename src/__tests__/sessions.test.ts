import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Session } from "@/lib/types";

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: "session-1",
  screenName: "Sales Dashboard",
  components: ["metric-cards", "line-chart"],
  archetypes: ["data-display"],
  scenarios: [{ name: "loading", description: "All skeleton" }],
  layoutDescription: { screenName: "Sales Dashboard", components: [] },
  states: {
    default: {
      jsx: "function GeneratedComponent() { return null; }",
      description: "Default",
    },
  },
  activeState: "default",
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

function mockFetch(responseData: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseData),
    })
  );
}

describe("getSessions", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns sessions from API", async () => {
    const { getSessions } = await import("@/lib/sessions");
    const sessions = [makeSession()];
    mockFetch(sessions);
    const result = await getSessions();
    expect(result).toEqual(sessions);
  });

  it("returns empty array on fetch failure", async () => {
    const { getSessions } = await import("@/lib/sessions");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await getSessions();
    expect(result).toEqual([]);
  });
});

describe("saveSession", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("posts session and returns updated list", async () => {
    const { saveSession } = await import("@/lib/sessions");
    const session = makeSession();
    mockFetch([session]);
    const result = await saveSession(session);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("session-1");
  });
});

describe("deleteSession", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("deletes session and returns remaining list", async () => {
    const { deleteSession } = await import("@/lib/sessions");
    const remaining = [makeSession({ id: "b" })];
    mockFetch(remaining);
    const result = await deleteSession("a");
    expect(result.find((s) => s.id === "a")).toBeUndefined();
  });
});

describe("updateSessionState", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("patches state and returns updated list", async () => {
    const { updateSessionState } = await import("@/lib/sessions");
    const updated = [makeSession({ id: "a", activeState: "loading" })];
    mockFetch(updated);
    const result = await updateSessionState("a", "loading");
    expect(result.find((s) => s.id === "a")?.activeState).toBe("loading");
  });
});
