import { NextRequest } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limiter";
import {
  generatePrototype,
  adaptScenario,
  refinePrototype,
  translateRecipeDoc,
} from "@/lib/generation";
import { useLiveAI } from "@/lib/ai-mode";
import { findArtifact } from "@/lib/artifacts";
import { findRecipe } from "@/lib/blade-recipes";
import type { LayoutDescription, Scenario, StateOutput, SSEEvent } from "@/lib/types";

// ─── Zod schema ──────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  scenarios: z.array(z.object({ name: z.string(), description: z.string() })),
  layoutDescription: z.object({
    screenName: z.string(),
    components: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        role: z.string(),
        count: z.number().optional(),
      }),
    ),
  }),
  userInstruction: z.string().optional(),
  archetypes: z.array(z.string()).optional(),
  currentPrototypeJsx: z.string().optional(),
});

type GenerateInput = z.infer<typeof GenerateSchema>;

// ─── Core generation orchestrator ────────────────────────────────────────────

async function runGeneration(
  data: GenerateInput,
  signal: AbortSignal,
  send: (event: SSEEvent) => void,
): Promise<void> {
  const { scenarios, layoutDescription, userInstruction, archetypes, currentPrototypeJsx } = data;

  if (!useLiveAI()) {
    const artifact = findArtifact(layoutDescription.screenName);
    const fallback = Object.values(artifact.states)[0] ?? {
      jsx: "function GeneratedComponent(){return null;}",
      description: "",
    };
    for (const s of scenarios) {
      const state = artifact.states[s.name] ?? fallback;
      send({ type: "state", name: s.name, jsx: state.jsx, description: state.description });
    }
    send({ type: "done" });
    return;
  }

  const protoScenario = scenarios.find((s) => s.name === "prototype") ?? scenarios[0];
  const recipe = findRecipe(layoutDescription.screenName);

  let protoResult: StateOutput;

  if (currentPrototypeJsx && userInstruction) {
    protoResult = await refinePrototype(currentPrototypeJsx, userInstruction, signal);
  } else if (recipe && !userInstruction) {
    if (recipe.patternDoc) {
      const translated = await translateRecipeDoc(recipe.patternDoc, signal);
      protoResult = translated
        ? { jsx: translated, description: protoScenario.description }
        : await generatePrototype(protoScenario, layoutDescription, undefined, archetypes ?? [], signal);
    } else if (recipe.prototypeJsx) {
      protoResult = { jsx: recipe.prototypeJsx, description: protoScenario.description };
    } else {
      protoResult = await generatePrototype(protoScenario, layoutDescription, userInstruction, archetypes ?? [], signal);
    }
  } else {
    protoResult = await generatePrototype(protoScenario, layoutDescription, userInstruction, archetypes ?? [], signal);
  }

  send({ type: "state", name: protoScenario.name, jsx: protoResult.jsx, description: protoResult.description });

  const rest = scenarios.filter((s) => s.name !== protoScenario.name);
  await Promise.allSettled(
    rest.map(async (s) => {
      try {
        const result = await adaptScenario(protoResult.jsx, s as Scenario, signal);
        send({ type: "state", name: s.name, jsx: result.jsx, description: result.description });
      } catch (err) {
        if ((err as Error).name === "AbortError") throw err;
        send({ type: "state_error", name: s.name, message: (err as Error).message ?? "Failed" });
      }
    }),
  );

  send({ type: "done" });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid request", details: parsed.error.issues }),
      { status: 400 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`generate:${ip}`, { limit: 30, windowMs: 60_000 })) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }), {
      status: 429,
    });
  }

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  function send(event: SSEEvent) {
    writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)).catch(() => {});
  }

  void runGeneration(parsed.data, req.signal, send)
    .catch((err) => {
      if ((err as Error).name !== "AbortError") {
        send({ type: "error", message: (err as Error).message ?? "Generation failed" });
      }
    })
    .finally(() => writer.close().catch(() => {}));

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
