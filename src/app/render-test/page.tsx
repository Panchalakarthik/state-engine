// MIGRATION TEST — renders the json-render Login spec across states.
"use client";

import { useState } from "react";
import login from "@/render/specs/login-page.json";
import { JsonCanvas } from "@/render/json-canvas";

type StateName = "default" | "loading" | "error";
const STATES: StateName[] = ["default", "loading", "error"];

export default function RenderTest() {
  const [active, setActive] = useState<StateName>("default");
  const spec = login.states[active].spec;

  return (
    <div style={{ maxWidth: 560, margin: "24px auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {STATES.map((s) => (
          <button
            key={s}
            onClick={() => setActive(s)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid #2a2a2a",
              background: s === active ? "#1e1e2e" : "#1a1a1a",
              color: s === active ? "#818cf8" : "#ccc",
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <JsonCanvas key={active} spec={spec} />
    </div>
  );
}
