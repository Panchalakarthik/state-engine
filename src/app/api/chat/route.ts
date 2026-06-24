import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limiter";
import { haikuModel } from "@/lib/anthropic";
import { classifyScreen } from "@/lib/classify-core";
import {
  generatePrototype,
  adaptScenario,
  refinePrototype,
  translateRecipeDoc,
} from "@/lib/generation";
import { findRecipe } from "@/lib/blade-recipes";
import type { AppUIMessage, StateData } from "@/lib/ai-types";
import type { Scenario } from "@/lib/types";

const AGENT_SYSTEM = `You are a UI state engine for Razorpay's Blade design system.

For a NEW screen request, always:
1. Call classify_screen with the screen name
2. Call generate_states with the classify result

For a MODIFICATION request (user says "change", "update", "add", "make it", etc.) when you already have scenarios in history:
1. Call generate_states directly with the existing scenarios, layoutDescription, and an instruction parameter
2. Do NOT classify again

Keep text responses to one sentence. Let the tools narrate the work.`;

const ScenarioSchema = z.object({ name: z.string(), description: z.string() });
const LayoutSchema = z.object({
  screenName: z.string(),
  components: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      role: z.string(),
      count: z.number().optional(),
    }),
  ),
});

export async function POST(req: Request) {
  let body: {
    messages: AppUIMessage[];
    currentPrototypeJsx?: string | null;
    activeSessionId?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { messages, currentPrototypeJsx, activeSessionId } = body;

  const ip =
    (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()) ?? "unknown";
  if (!checkRateLimit(`chat:${ip}`, { limit: 30, windowMs: 60_000 })) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429 });
  }

  const stream = createUIMessageStream<AppUIMessage>({
    execute: async ({ writer }) => {
      const result = streamText({
        model: haikuModel,
        system: AGENT_SYSTEM,
        messages: await convertToModelMessages(messages),
        tools: {
          classify_screen: {
            description: "Classify a screen name into design archetypes and UI scenarios",
            inputSchema: z.object({ screenName: z.string() }),
            execute: async ({ screenName }) => {
              return await classifyScreen(screenName, [], req.signal);
            },
          },
          generate_states: {
            description:
              "Generate Blade JSX for all UI scenarios. Pass `instruction` to modify an existing design instead of generating from scratch.",
            inputSchema: z.object({
              scenarios: z.array(ScenarioSchema),
              layoutDescription: LayoutSchema,
              archetypes: z.array(z.string()).optional(),
              instruction: z.string().optional(),
            }),
            execute: async (args: {
              scenarios: { name: string; description: string }[];
              layoutDescription: { screenName: string; components: { id: string; type: string; role: string; count?: number }[] };
              archetypes?: string[];
              instruction?: string;
            }) => {
              const { scenarios, layoutDescription, archetypes, instruction } = args;
              const sessionId = activeSessionId ?? crypto.randomUUID();
              const protoScenario = scenarios.find((s) => s.name === "prototype") ?? scenarios[0];
              if (!protoScenario) return { stateNames: [] };

              const recipe = findRecipe(layoutDescription.screenName);

              // ── Prototype ──────────────────────────────────────────────────
              let protoJsx: string;
              let protoDesc: string = protoScenario.description;

              if (currentPrototypeJsx && instruction) {
                const refined = await refinePrototype(currentPrototypeJsx, instruction, req.signal);
                protoJsx = refined.jsx;
                protoDesc = refined.description;
              } else if (recipe && !instruction) {
                if (recipe.patternDoc) {
                  const translated = await translateRecipeDoc(recipe.patternDoc, req.signal);
                  if (translated) {
                    protoJsx = translated;
                  } else {
                    const generated = await generatePrototype(protoScenario, layoutDescription, undefined, archetypes ?? [], req.signal);
                    protoJsx = generated.jsx;
                  }
                } else if (recipe.prototypeJsx) {
                  protoJsx = recipe.prototypeJsx;
                } else {
                  const generated = await generatePrototype(protoScenario, layoutDescription, instruction, archetypes ?? [], req.signal);
                  protoJsx = generated.jsx;
                }
              } else {
                const generated = await generatePrototype(protoScenario, layoutDescription, instruction, archetypes ?? [], req.signal);
                protoJsx = generated.jsx;
              }

              const sessionCtx = {
                sessionId,
                screenName: layoutDescription.screenName,
                archetypes: archetypes ?? [],
                scenarios: scenarios as Scenario[],
              };

              writer.write({
                type: "data-state",
                data: { ...sessionCtx, name: protoScenario.name, jsx: protoJsx, description: protoDesc } as StateData,
              });

              // ── Remaining scenarios in parallel ────────────────────────────
              const rest = scenarios.filter((s) => s.name !== protoScenario.name);
              await Promise.allSettled(
                rest.map(async (s) => {
                  try {
                    const result = await adaptScenario(protoJsx, s as Scenario, req.signal);
                    writer.write({
                      type: "data-state",
                      data: { ...sessionCtx, name: s.name, jsx: result.jsx, description: result.description } as StateData,
                    });
                  } catch (err) {
                    if ((err as Error).name !== "AbortError") {
                      console.warn(`[chat] state "${s.name}" failed:`, err);
                    }
                  }
                }),
              );

              return { stateNames: scenarios.map((s) => s.name) };
            },
          },
        },
        stopWhen: stepCountIs(5),
      });

      writer.merge(result.toUIMessageStream({ sendReasoning: true }));
    },
    onError: (error) => (error instanceof Error ? error.message : "Generation failed"),
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "X-Accel-Buffering": "no" },
  });
}
