// SMOKE TEST ONLY — /smoke route. Renders real Blade from a JSON spec via
// json-render. Isolated from the main app. Safe to delete.
"use client";

import { Renderer, JSONUIProvider } from "@json-render/react";
import { registry } from "@/smoke/registry";

// A JSON spec — the kind of thing the AI would emit. No JSX, no eval.
const spec = {
  root: "stack-1",
  elements: {
    "stack-1": {
      type: "Stack",
      props: {},
      children: ["alert-1", "email-1", "btn-1"],
    },
    "alert-1": {
      type: "Alert",
      props: {
        title: "Smoke test passed",
        description:
          "This Blade Alert was rendered from a JSON spec via json-render — no eval, no JSX string.",
        color: "positive",
      },
      children: [],
    },
    "email-1": {
      type: "TextInput",
      props: {
        label: "Email",
        placeholder: "you@company.com",
        value: { $bindState: "form.email" },
      },
      children: [],
    },
    "btn-1": {
      type: "Button",
      props: { label: "Submit", variant: "primary", isDisabled: null },
      children: [],
    },
  },
};

export default function SmokePage() {
  return (
    <div style={{ maxWidth: 520, margin: "40px auto" }}>
      {/* BladeProvider is already supplied by the root layout */}
      <JSONUIProvider registry={registry} initialState={{ form: { email: "" } }}>
        <Renderer spec={spec} registry={registry} />
      </JSONUIProvider>
    </div>
  );
}
