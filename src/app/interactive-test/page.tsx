// MIGRATION TEST — interactive Login as a declarative json-render spec.
// Proves: empty -> disabled button, submit -> spinner + disabled inputs,
// then -> error (alert + red fields). No useState in the component.
"use client";

import { useMemo } from "react";
import { Renderer, JSONUIProvider, createStateStore } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { registry } from "@/render/registry";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const spec: Spec = {
  root: "root",
  elements: {
    root: { type: "Box", props: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "spacing.7" }, children: ["wrap"] },
    wrap: { type: "Box", props: { width: "100%", maxWidth: "400px" }, children: ["card"] },
    card: { type: "Card", props: { padding: "spacing.7" }, children: ["form"] },
    form: { type: "Box", props: { display: "flex", flexDirection: "column", gap: "spacing.5" }, children: ["title", "sub", "alert", "email", "password", "submit"] },
    title: { type: "Heading", props: { text: "Welcome back", size: "large" }, children: [] },
    sub: { type: "Text", props: { text: "Sign in to your Razorpay account", size: "small" }, children: [] },
    alert: { type: "Alert", props: { description: "Invalid email or password. Please try again.", color: "negative" }, children: [], visible: { $state: "/form/hasError" } },
    email: { type: "TextInput", props: { label: "Email", placeholder: "you@company.com", value: { $bindState: "/form/email" }, isDisabled: { $state: "/form/submitting" }, validationState: { $state: "/form/fieldState" } }, children: [] },
    password: { type: "PasswordInput", props: { label: "Password", placeholder: "Enter your password", value: { $bindState: "/form/password" }, isDisabled: { $state: "/form/submitting" }, validationState: { $state: "/form/fieldState" } }, children: [] },
    submit: { type: "Button", props: { text: "Sign in", variant: "primary", isFullWidth: true, isLoading: { $state: "/form/submitting" }, isDisabled: { $computed: "isFormIncomplete", args: { email: { $state: "/form/email" }, password: { $state: "/form/password" } } } }, children: [], on: { press: { action: "submit" } } },
  },
} as unknown as Spec;

export default function InteractiveTest() {
  const store = useMemo(
    () =>
      createStateStore({
        form: { email: "", password: "", submitting: false, hasError: false, fieldState: "none" },
      }),
    [],
  );

  const handlers = useMemo(
    () => ({
      submit: async () => {
        store.set("/form/hasError", false);
        store.set("/form/fieldState", "none");
        store.set("/form/submitting", true);
        await delay(1500);
        store.set("/form/submitting", false);
        store.set("/form/hasError", true);
        store.set("/form/fieldState", "error");
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

  return (
    <div style={{ maxWidth: 520, margin: "40px auto" }}>
      <JSONUIProvider
        registry={registry}
        store={store}
        handlers={handlers}
        functions={functions}
      >
        <Renderer spec={spec} registry={registry} />
      </JSONUIProvider>
    </div>
  );
}
