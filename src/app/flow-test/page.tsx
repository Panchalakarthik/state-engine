// MIGRATION TEST — a two-screen FLOW: Login --(success)--> Dashboard.
// Proves: positive submit path + chaining specs into a navigable flow.
"use client";

import { useMemo, useState } from "react";
import { Renderer, JSONUIProvider, createStateStore } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { registry } from "@/render/registry";
import dashboard from "@/render/specs/sales-dashboard.json";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const loginSpec: Spec = {
  root: "root",
  elements: {
    root: { type: "Box", props: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "spacing.7" }, children: ["wrap"] },
    wrap: { type: "Box", props: { width: "100%", maxWidth: "400px" }, children: ["card"] },
    card: { type: "Card", props: { padding: "spacing.7" }, children: ["form"] },
    form: { type: "Box", props: { display: "flex", flexDirection: "column", gap: "spacing.5" }, children: ["title", "sub", "email", "password", "submit"] },
    title: { type: "Heading", props: { text: "Welcome back", size: "large" }, children: [] },
    sub: { type: "Text", props: { text: "Sign in to your Razorpay account", size: "small" }, children: [] },
    email: { type: "TextInput", props: { label: "Email", placeholder: "you@company.com", value: { $bindState: "/form/email" }, isDisabled: { $state: "/form/submitting" }, checks: [{ type: "email", message: "Enter a valid email address" }] }, children: [] },
    password: { type: "PasswordInput", props: { label: "Password", placeholder: "Enter your password", value: { $bindState: "/form/password" }, isDisabled: { $state: "/form/submitting" } }, children: [] },
    submit: { type: "Button", props: { text: "Sign in", variant: "primary", isFullWidth: true, isLoading: { $state: "/form/submitting" }, isDisabled: { $computed: "isFormIncomplete", args: { email: { $state: "/form/email" }, password: { $state: "/form/password" } } } }, children: [], on: { press: { action: "submit" } } },
  },
} as unknown as Spec;

export default function FlowTest() {
  const [screen, setScreen] = useState<"login" | "dashboard">("login");

  const store = useMemo(
    () => createStateStore({ form: { email: "", password: "", submitting: false } }),
    [],
  );

  const handlers = useMemo(
    () => ({
      submit: async () => {
        store.set("/form/submitting", true);
        await delay(1200); // simulate auth round-trip
        store.set("/form/submitting", false);
        setScreen("dashboard"); // success -> next screen in the flow
      },
    }),
    [store],
  );

  const functions = useMemo(
    () => ({
      isFormIncomplete: ({ email, password }: Record<string, unknown>) =>
        !email || !password,
    }),
    [],
  );

  const validationFunctions = useMemo(
    () => ({
      email: (value: unknown) => {
        const s = String(value ?? "");
        return s === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
      },
    }),
    [],
  );

  return (
    <div style={{ maxWidth: 760, margin: "24px auto" }}>
      <div style={{ marginBottom: 12, fontSize: 13, color: "#666" }}>
        Flow: <b style={{ color: screen === "login" ? "#818cf8" : "#666" }}>Login</b>
        {"  →  "}
        <b style={{ color: screen === "dashboard" ? "#818cf8" : "#666" }}>Dashboard</b>
        {screen === "dashboard" && (
          <button
            onClick={() => {
              store.set("/form/email", "");
              store.set("/form/password", "");
              setScreen("login");
            }}
            style={{ marginLeft: 16, padding: "4px 10px", borderRadius: 6, border: "1px solid #2a2a2a", background: "#1a1a1a", color: "#ccc", cursor: "pointer" }}
          >
            ↺ replay
          </button>
        )}
      </div>

      {screen === "login" ? (
        <JSONUIProvider
          registry={registry}
          store={store}
          handlers={handlers}
          functions={functions}
          validationFunctions={validationFunctions}
        >
          <Renderer spec={loginSpec} registry={registry} />
        </JSONUIProvider>
      ) : (
        <JSONUIProvider registry={registry} initialState={{}}>
          <Renderer spec={dashboard.states.default.spec as unknown as Spec} registry={registry} />
        </JSONUIProvider>
      )}
    </div>
  );
}
