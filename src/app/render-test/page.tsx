// MIGRATION TEST — renders json-render specs across screens + states.
"use client";

import { useState } from "react";
import login from "@/render/specs/login-page.json";
import dashboard from "@/render/specs/sales-dashboard.json";
import { JsonCanvas } from "@/render/json-canvas";

type StateName = "default" | "loading" | "error";
const STATES: StateName[] = ["default", "loading", "error"];
const SCREENS = { login, dashboard } as const;
type ScreenName = keyof typeof SCREENS;

export default function RenderTest() {
  const [screen, setScreen] = useState<ScreenName>("dashboard");
  const [active, setActive] = useState<StateName>("default");
  const spec = SCREENS[screen].states[active].spec;

  const tab = (on: boolean) => ({
    padding: "6px 14px",
    borderRadius: 8,
    border: "1px solid #2a2a2a",
    background: on ? "#1e1e2e" : "#1a1a1a",
    color: on ? "#818cf8" : "#ccc",
    cursor: "pointer",
  });

  return (
    <div style={{ maxWidth: 760, margin: "24px auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {(Object.keys(SCREENS) as ScreenName[]).map((s) => (
          <button key={s} onClick={() => setScreen(s)} style={tab(s === screen)}>
            {s}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {STATES.map((s) => (
          <button key={s} onClick={() => setActive(s)} style={tab(s === active)}>
            {s}
          </button>
        ))}
      </div>
      <JsonCanvas key={`${screen}-${active}`} spec={spec} />
    </div>
  );
}
