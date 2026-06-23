// Renders a json-render spec with the Blade registry. This is the Path B
// replacement for the babel-eval canvas — no eval, validated spec.
"use client";

import { Renderer, JSONUIProvider } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { registry } from "./registry";

interface JsonCanvasProps {
  spec: unknown;
}

export function JsonCanvas({ spec }: JsonCanvasProps) {
  return (
    <JSONUIProvider
      registry={registry}
      initialState={{ form: { email: "", password: "" } }}
    >
      <Renderer spec={spec as Spec} registry={registry} />
    </JSONUIProvider>
  );
}
