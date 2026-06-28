import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  stepCountIs,
  hasToolCall,
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
  verifyDesignLabels,
} from "@/lib/generation";
import { findRecipe } from "@/lib/blade-recipes";
import type { AppUIMessage, StateData } from "@/lib/ai-types";
import type { Scenario } from "@/lib/types";
import type { ImageContext } from "@/lib/prompts";
import { ANALYZE_IMAGE_PROMPT } from "@/lib/prompts";

const AGENT_SYSTEM_TEXT = `You are a UI state engine for Razorpay's Blade design system.

For a NEW screen request, always:
1. Call classify_screen with the screen name
2. Call generate_states with the classify result

For a MODIFICATION request (user says "change", "update", "add", "make it", etc.) when you already have scenarios in history:
1. Call generate_states directly with the existing scenarios, layoutDescription, and an instruction parameter
2. Do NOT classify again

ABSOLUTE OUTPUT RULES — any violation corrupts the UI and is never acceptable:
- NEVER output JSX, code blocks, imports, or component source — not even a snippet
- After generate_states returns: output ZERO text. Not a summary. Not state names. Not "Here are the states". Nothing.
- Before any tool call: ONE sentence maximum (e.g. "Generating your screen.")
- The generate_states tool result is internal only — never reference or repeat its contents to the user`;

const AGENT_SYSTEM_IMAGE = `You are a UI state engine for Razorpay's Blade design system.

The user has shared a Figma frame image. Follow these steps IN ORDER:
1. Call analyze_image — examine the image in the conversation and fill in ALL schema fields based on what you see
2. Call classify_screen with the extracted screenName; pass the extracted field labels and button labels as the components list
3. Call generate_states with the classify result AND the imageContext from analyze_image

ABSOLUTE OUTPUT RULES — any violation corrupts the UI and is never acceptable:
- NEVER output JSX, code blocks, imports, or component source — not even a snippet
- After generate_states returns: output ZERO text. Not a summary. Not state names. Not "Here are the states". Nothing.
- Before any tool call: ONE sentence maximum (e.g. "I'll analyze the image and generate all states.")
- The generate_states tool result is internal only — never reference or repeat its contents to the user`;

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
  // .catch() on every required string/array — first model call often has minor shape issues
  screenName: z.string().catch("Unknown Screen"),
  heading: z.string().catch(""),
  subheading: z.string().optional(),
  sections: z.array(z.string().catch("")).catch([]),
  fields: z.array(
    z.object({
      label: z.string().catch(""),
      type: z.enum(["text", "email", "password", "phone", "date", "number", "textarea"]).catch("text"),
      format: z.string().optional(),
      required: z.boolean().catch(false),
    }),
  ).catch([]),
  buttons: z.array(
    z.object({
      label: z.string().catch(""),
      variant: z.enum(["primary", "secondary", "tertiary"]).catch("primary"),
    }),
  ).catch([]),
  badges: z.array(z.object({ label: z.string().catch(""), color: z.string().catch("neutral") })).optional().default([]),
  alerts: z.array(z.object({ type: z.string().catch(""), message: z.string().optional() })).optional().default([]),
  colorMood: z.string().catch(""),
  layout: z.object({
    type: z.enum([
      "single-column",
      "sidebar-content",
      "split-screen",
      "card-grid",
      "header-tabs",
    ]).catch("single-column"),
    sidebar: z
      .object({
        position: z.enum(["left", "right"]).catch("left"),
        width: z.string().optional(),
        navItems: z.array(z.string().catch("")).catch([]),
        hasIcons: z.boolean().catch(false),
        itemSpacing: z.enum(["compact", "normal", "relaxed"]).catch("normal"),
        activeStyle: z.enum(["filled", "outlined", "underline"]).catch("filled"),
      })
      .optional(),
    header: z
      .object({
        type: z.enum(["topnav", "simple-heading"]).catch("simple-heading"),
        hasSidebarToggle: z.boolean().catch(false),
        breadcrumb: z.string().optional(),
        hasNotificationBell: z.boolean().catch(false),
        notificationCount: z.number().optional(),
        hasAvatar: z.boolean().catch(false),
        userName: z.string().optional(),
        userRole: z.string().optional(),
        hasUserDropdown: z.boolean().catch(false),
        hasSearch: z.boolean().catch(false),
      })
      .optional(),
    sections: z.array(
      z.object({
        heading: z.string().optional(),
        containerType: z.enum(["card", "plain"]).catch("plain"),
        columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).catch(1 as 1),
        contentType: z.enum([
          "form-fields",
          "metric-cards",
          "data-rows",
          "list-items",
        ]).catch("form-fields"),
        gap: z.enum(["none", "xs", "sm", "md", "lg"]).optional(),
        padding: z.enum(["none", "xs", "sm", "md", "lg"]).optional(),
        itemSizing: z.enum(["fill", "hug", "fixed"]).optional(),
        fieldRows: z.array(z.array(z.string().catch(""))).catch([]).optional(),
        items: z
          .array(
            z.object({
              title: z.string().catch(""),
              description: z.string().optional(),
              badge: z.string().optional(),
              badgeColor: z
                .enum(["positive", "negative", "notice", "neutral"])
                .optional(),
            }),
          )
          .optional(),
      }),
    ).catch([]),
    activeNavItem: z.string().optional(),
    contentPadding: z.enum(["sm", "md", "lg"]).optional(),
    sectionGap: z.enum(["sm", "md", "lg"]).optional(),
  }).catch({ type: "single-column", sections: [] } as never),
  progressBars: z.array(
    z.object({
      label: z.string().catch(""),
      value: z.number().min(0).max(100).catch(0),
      description: z.string().optional(),
    }),
  ).optional(),
  assets: z.array(
    z.object({
      type: z.enum(["logo", "photo", "avatar", "icon", "illustration"]).catch("icon"),
      label: z.string().catch(""),
      position: z.string().catch(""),
      bladeFallback: z.string().catch(""),
    }),
  ).optional(),
  statusIndicators: z.array(z.string().catch("")).optional(),
  // layoutSkeleton is NOT in ImageContextSchema — JSX strings in JSON tool-call args corrupt encoding.
  // Skeleton is generated server-side after analyze_image completes (see capturedLayoutSkeleton).
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

  // Strip empty text parts — Anthropic rejects content blocks with text: ""
  const normalizedMessages = messages.map((msg) => {
    if (msg.role !== "user") return msg;
    const filtered = (msg.parts ?? []).filter((part) => {
      const p = part as Record<string, unknown>;
      if (p.type === "text" && (p.text === "" || p.text == null)) return false;
      return true;
    });
    return { ...msg, parts: filtered };
  }) as AppUIMessage[];

  // Detect image in the latest user message
  const latestMsg = messages[messages.length - 1];
  const latestParts = latestMsg?.parts ?? [];
  const hasImage =
    latestMsg?.role === "user" &&
    latestParts.some(
      (p: unknown) => typeof p === "object" && p !== null && (p as { type: string }).type === "file",
    );

  const model = hasImage ? sonnetModel : haikuModel;
  const systemPrompt = hasImage ? AGENT_SYSTEM_IMAGE : AGENT_SYSTEM_TEXT;

  // Capture imageContext server-side so generate_states doesn't need the model to re-serialize
  // layoutSkeleton (multi-line JSX with lots of " chars that break JSON encoding)
  let capturedImageContext: z.infer<typeof ImageContextSchema> | undefined;

  const stream = createUIMessageStream<AppUIMessage>({
    execute: async ({ writer }) => {
      const modelMessages = await convertToModelMessages(normalizedMessages);
      const result = streamText({
        model,
        system: systemPrompt,
        messages: modelMessages,
        tools: {
          ...(hasImage
            ? {
                analyze_image: {
                  description: ANALYZE_IMAGE_PROMPT,
                  inputSchema: ImageContextSchema,
                  execute: async (imageContext: z.infer<typeof ImageContextSchema>) => {
                    // Capture server-side — layoutSkeleton must not pass through model JSON
                    capturedImageContext = imageContext;
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
              const { scenarios, layoutDescription, archetypes, instruction } = args;
              // Prefer server-captured imageContext (has layoutSkeleton; model re-pass drops it)
              const imageContext: ImageContext | undefined =
                (capturedImageContext ?? args.imageContext) as ImageContext | undefined;
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

              // ── Design verification + auto-correction ────────────────────
              let verification: { score: number; missing: string[] } | undefined;
              if (imageContext) {
                const result = verifyDesignLabels(protoJsx, imageContext);
                verification = result;
                if (result.missing.length >= 2) {
                  const correctionInstruction = `CORRECTION — these exact elements from the Figma design are missing: ${result.missing.join(", ")}. You MUST include all of them verbatim.`;
                  try {
                    const corrected = await generatePrototype(
                      protoScenario,
                      layoutDescription,
                      correctionInstruction,
                      archetypes ?? [],
                      req.signal,
                      imageContext,
                    );
                    const afterRetry = verifyDesignLabels(corrected.jsx, imageContext);
                    if (afterRetry.score >= result.score) {
                      protoJsx = corrected.jsx;
                      verification = afterRetry;
                    }
                  } catch (err) {
                    if ((err as Error).name === "AbortError") throw err;
                  }
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

              return { generated: scenarios.length };
            },
          },
        },
        // Stop as soon as generate_states has fired — prevents any model text after tool calls
      stopWhen: [hasToolCall("generate_states"), stepCountIs(6)],
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
