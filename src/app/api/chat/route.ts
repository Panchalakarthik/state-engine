import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limiter";
import { haikuModel, sonnetModel } from "@/lib/anthropic";
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
import type { ImageContext } from "@/lib/prompts";

const AGENT_SYSTEM_TEXT = `You are a UI state engine for Razorpay's Blade design system.

For a NEW screen request, always:
1. Call classify_screen with the screen name
2. Call generate_states with the classify result

For a MODIFICATION request (user says "change", "update", "add", "make it", etc.) when you already have scenarios in history:
1. Call generate_states directly with the existing scenarios, layoutDescription, and an instruction parameter
2. Do NOT classify again

Keep text responses to one sentence. Let the tools narrate the work.`;

const AGENT_SYSTEM_IMAGE = `You are a UI state engine for Razorpay's Blade design system.

The user has shared a Figma frame image. Follow these steps IN ORDER:
1. Call analyze_image — examine the image in the conversation and fill in ALL schema fields based on what you see
2. Call classify_screen with the extracted screenName; pass the extracted field labels and button labels as the components list
3. Call generate_states with the classify result AND the imageContext from analyze_image

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

const ImageContextSchema = z.object({
  screenName: z.string(),
  heading: z.string(),
  subheading: z.string().optional(),
  sections: z.array(z.string()),
  fields: z.array(
    z.object({
      label: z.string(),
      type: z.enum(["text", "email", "password", "phone", "date", "number", "textarea"]),
      format: z.string().optional(),
      required: z.boolean(),
    }),
  ),
  buttons: z.array(
    z.object({
      label: z.string(),
      variant: z.enum(["primary", "secondary", "tertiary"]),
    }),
  ),
  badges: z.array(z.object({ label: z.string(), color: z.string() })),
  alerts: z.array(z.object({ type: z.string(), message: z.string().optional() })),
  colorMood: z.string(),
  layout: z.object({
    type: z.enum([
      "single-column",
      "sidebar-content",
      "split-screen",
      "card-grid",
      "header-tabs",
    ]),
    sidebar: z
      .object({
        position: z.enum(["left", "right"]),
        navItems: z.array(z.string()),
      })
      .optional(),
    header: z
      .object({
        type: z.enum(["topnav", "simple-heading"]),
        hasAvatar: z.boolean(),
        hasSearch: z.boolean(),
      })
      .optional(),
    sections: z.array(
      z.object({
        heading: z.string().optional(),
        containerType: z.enum(["card", "plain"]),
        columns: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        contentType: z.enum([
          "form-fields",
          "metric-cards",
          "data-rows",
          "list-items",
        ]),
      }),
    ),
  }),
  assets: z.array(
    z.object({
      type: z.enum(["logo", "photo", "avatar", "icon", "illustration"]),
      label: z.string(),
      position: z.string(),
      bladeFallback: z.string(),
    }),
  ),
  statusIndicators: z.array(z.string()),
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

  // Detect image in the latest user message
  const latestMsg = messages[messages.length - 1];
  const hasImage =
    latestMsg?.role === "user" &&
    (latestMsg.parts ?? []).some(
      (p: unknown) => typeof p === "object" && p !== null && (p as { type: string }).type === "file",
    );

  const model = hasImage ? sonnetModel : haikuModel;
  const systemPrompt = hasImage ? AGENT_SYSTEM_IMAGE : AGENT_SYSTEM_TEXT;

  const stream = createUIMessageStream<AppUIMessage>({
    execute: async ({ writer }) => {
      const result = streamText({
        model,
        system: systemPrompt,
        messages: await convertToModelMessages(messages),
        tools: {
          ...(hasImage
            ? {
                analyze_image: {
                  description:
                    "Analyze the Figma frame image in the conversation. Examine the image carefully and fill in every field in the schema based on what you see. Do not skip optional fields if they are visible.",
                  inputSchema: ImageContextSchema,
                  execute: async (imageContext: z.infer<typeof ImageContextSchema>) => {
                    // Model fills schema by examining the image — just return the extracted data
                    return imageContext;
                  },
                },
              }
            : {}),
          classify_screen: {
            description: "Classify a screen name into design archetypes and UI scenarios",
            inputSchema: z.object({
              screenName: z.string(),
              components: z
                .array(z.string())
                .optional()
                .describe(
                  "When imageContext is available, pass extracted field labels and button labels here to improve scenario derivation",
                ),
            }),
            execute: async ({ screenName, components }) => {
              return await classifyScreen(screenName, components ?? [], req.signal);
            },
          },
          generate_states: {
            description:
              "Generate Blade JSX for all UI scenarios. Pass `instruction` to modify an existing design. Pass `imageContext` when an image was analyzed to reproduce the exact Figma design.",
            inputSchema: z.object({
              scenarios: z.array(ScenarioSchema),
              layoutDescription: LayoutSchema,
              archetypes: z.array(z.string()).optional(),
              instruction: z.string().optional(),
              imageContext: ImageContextSchema.optional(),
            }),
            execute: async (args: {
              scenarios: { name: string; description: string }[];
              layoutDescription: {
                screenName: string;
                components: {
                  id: string;
                  type: string;
                  role: string;
                  count?: number;
                }[];
              };
              archetypes?: string[];
              instruction?: string;
              imageContext?: ImageContext;
            }) => {
              const { scenarios, layoutDescription, archetypes, instruction, imageContext } =
                args;
              const sessionId = activeSessionId ?? crypto.randomUUID();
              const protoScenario =
                scenarios.find((s) => s.name === "prototype") ?? scenarios[0];
              if (!protoScenario) return { stateNames: [] };

              const recipe = findRecipe(layoutDescription.screenName);

              // ── Prototype ────────────────────────────────────────────────────
              let protoJsx: string;
              let protoDesc: string = protoScenario.description;

              if (currentPrototypeJsx && instruction) {
                const refined = await refinePrototype(
                  currentPrototypeJsx,
                  instruction,
                  req.signal,
                );
                protoJsx = refined.jsx;
                protoDesc = refined.description;
              } else if (recipe && !instruction && !imageContext) {
                // Recipe path only used when there is no image context
                if (recipe.patternDoc) {
                  const translated = await translateRecipeDoc(recipe.patternDoc, req.signal);
                  if (translated) {
                    protoJsx = translated;
                  } else {
                    const generated = await generatePrototype(
                      protoScenario,
                      layoutDescription,
                      undefined,
                      archetypes ?? [],
                      req.signal,
                    );
                    protoJsx = generated.jsx;
                  }
                } else if (recipe.prototypeJsx) {
                  protoJsx = recipe.prototypeJsx;
                } else {
                  const generated = await generatePrototype(
                    protoScenario,
                    layoutDescription,
                    instruction,
                    archetypes ?? [],
                    req.signal,
                  );
                  protoJsx = generated.jsx;
                }
              } else {
                // Default path — also the image path (imageContext passed here)
                try {
                  const generated = await generatePrototype(
                    protoScenario,
                    layoutDescription,
                    instruction,
                    archetypes ?? [],
                    req.signal,
                    imageContext,
                  );
                  protoJsx = generated.jsx;
                } catch (err) {
                  if ((err as Error).name === "AbortError") throw err;
                  if (!imageContext) throw err; // only retry when imageContext is the plausible cause
                  // Graceful degradation: if imageContext caused generation to fail, retry without it
                  console.warn("[chat] generatePrototype with imageContext failed, retrying without:", err);
                  const fallback = await generatePrototype(
                    protoScenario,
                    layoutDescription,
                    instruction,
                    archetypes ?? [],
                    req.signal,
                  );
                  protoJsx = fallback.jsx;
                }
              }

              const sessionCtx = {
                sessionId,
                screenName: layoutDescription.screenName,
                archetypes: archetypes ?? [],
                scenarios: scenarios as Scenario[],
              };

              writer.write({
                type: "data-state",
                data: {
                  ...sessionCtx,
                  name: protoScenario.name,
                  jsx: protoJsx,
                  description: protoDesc,
                } as StateData,
              });

              // ── Remaining scenarios in parallel ──────────────────────────────
              const rest = scenarios.filter((s) => s.name !== protoScenario.name);
              await Promise.allSettled(
                rest.map(async (s) => {
                  try {
                    const result = await adaptScenario(
                      protoJsx,
                      s as Scenario,
                      req.signal,
                      imageContext,
                    );
                    writer.write({
                      type: "data-state",
                      data: {
                        ...sessionCtx,
                        name: s.name,
                        jsx: result.jsx,
                        description: result.description,
                      } as StateData,
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
        stopWhen: stepCountIs(6),
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
