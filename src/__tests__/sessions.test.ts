import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", { localStorage: localStorageMock });

import {
  getSessions,
  saveSession,
  deleteSession,
  updateSessionState,
} from "@/lib/sessions";
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

describe("getSessions", () => {
  beforeEach(() => localStorageMock.clear());

  it("returns empty array when nothing stored", () => {
    expect(getSessions()).toEqual([]);
  });
});

describe("saveSession", () => {
  beforeEach(() => localStorageMock.clear());

  it("saves a new session and returns updated list", () => {
    const session = makeSession();
    const result = saveSession(session);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("session-1");
  });

  it("updates an existing session (same id)", () => {
    const session = makeSession();
    saveSession(session);
    const updated = saveSession({ ...session, screenName: "Updated" });
    expect(updated).toHaveLength(1);
    expect(updated[0].screenName).toBe("Updated");
  });

  it("prepends new sessions (newest first)", () => {
    saveSession(makeSession({ id: "a" }));
    const result = saveSession(makeSession({ id: "b" }));
    expect(result[0].id).toBe("b");
    expect(result[1].id).toBe("a");
  });

  it("prunes to 20 sessions max", () => {
    for (let i = 0; i < 21; i++) {
      saveSession(makeSession({ id: `session-${i}` }));
    }
    expect(getSessions()).toHaveLength(20);
  });
});

describe("deleteSession", () => {
  beforeEach(() => localStorageMock.clear());

  it("removes session by id", () => {
    saveSession(makeSession({ id: "a" }));
    saveSession(makeSession({ id: "b" }));
    const result = deleteSession("a");
    expect(result.find((s) => s.id === "a")).toBeUndefined();
    expect(result).toHaveLength(1);
  });
});

describe("updateSessionState", () => {
  beforeEach(() => localStorageMock.clear());

  it("updates activeState for matching session", () => {
    saveSession(makeSession({ id: "a", activeState: "default" }));
    const result = updateSessionState("a", "loading");
    expect(result.find((s) => s.id === "a")?.activeState).toBe("loading");
  });
});
