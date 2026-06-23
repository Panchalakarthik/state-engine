// The Blade catalog: the set of components the AI (and fixtures) may emit.
// This IS the guardrail — a spec can only reference these types.
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

const spacing = z.string().nullable(); // "spacing.5" etc.

export const bladeCatalog = defineCatalog(schema, {
  components: {
    // --- Layout ---
    Box: {
      props: z.object({
        display: z.enum(["flex", "block"]).nullable(),
        flexDirection: z.enum(["row", "column"]).nullable(),
        gap: spacing,
        padding: spacing,
        alignItems: z.string().nullable(),
        justifyContent: z.string().nullable(),
        width: z.string().nullable(),
        maxWidth: z.string().nullable(),
        height: z.string().nullable(),
        borderRadius: z.enum(["small", "medium", "large"]).nullable(),
        backgroundColor: z
          .enum([
            "surface.background.gray.subtle",
            "surface.background.gray.moderate",
            "surface.background.gray.intense",
          ])
          .nullable(),
      }),
      description:
        "Flexbox layout container. Use display='flex' with flexDirection, gap, padding for layout.",
    },
    Card: {
      props: z.object({ padding: spacing }),
      description:
        "Elevated card container. Put content directly as its children (CardBody is added automatically).",
    },
    Divider: {
      props: z.object({}),
      description: "Horizontal divider line.",
    },

    // --- Typography ---
    Heading: {
      props: z.object({
        text: z.string(),
        size: z.enum(["small", "medium", "large", "xlarge"]).nullable(),
      }),
      description: "Section/page heading.",
    },
    Text: {
      props: z.object({
        text: z.string(),
        size: z.enum(["xsmall", "small", "medium", "large"]).nullable(),
        weight: z.enum(["regular", "medium", "semibold"]).nullable(),
      }),
      description: "Body text / labels / values.",
    },

    // --- Feedback ---
    Alert: {
      props: z.object({
        description: z.string(),
        title: z.string().nullable(),
        color: z
          .enum(["information", "negative", "neutral", "notice", "positive"])
          .nullable(),
      }),
      description: "Feedback banner. Use color='negative' for errors.",
    },
    Badge: {
      props: z.object({
        text: z.string(),
        color: z
          .enum([
            "information",
            "negative",
            "neutral",
            "notice",
            "positive",
            "primary",
          ])
          .nullable(),
        size: z.enum(["xsmall", "small", "medium", "large"]).nullable(),
      }),
      description: "Small status label.",
    },
    Skeleton: {
      props: z.object({
        width: z.string().nullable(),
        height: z.string().nullable(),
        borderRadius: z.enum(["small", "medium", "large"]).nullable(),
      }),
      description: "Loading shimmer placeholder. Use for every value in the loading state.",
    },

    // --- Actions / Forms ---
    Button: {
      props: z.object({
        text: z.string(),
        variant: z.enum(["primary", "secondary", "tertiary"]).nullable(),
        isFullWidth: z.boolean().nullable(),
        isDisabled: z.boolean().nullable(),
        isLoading: z.boolean().nullable(),
      }),
      description: "Clickable button. isLoading shows a spinner.",
    },
    TextInput: {
      props: z.object({
        label: z.string(),
        placeholder: z.string().nullable(),
        value: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable(),
        validationState: z.enum(["none", "error"]).nullable(),
        isDisabled: z.boolean().nullable(),
        checks: z
          .array(z.object({ type: z.string(), message: z.string() }))
          .nullable(),
      }),
      description:
        "Text input. value supports $bindState binding. checks=[{type,message}] for inline validation (e.g. type 'email', 'required').",
    },
    PasswordInput: {
      props: z.object({
        label: z.string(),
        placeholder: z.string().nullable(),
        value: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable(),
        validationState: z.enum(["none", "error"]).nullable(),
        isDisabled: z.boolean().nullable(),
      }),
      description: "Password input with show/hide. value supports $bindState binding.",
    },
    Checkbox: {
      props: z.object({
        label: z.string(),
        isDisabled: z.boolean().nullable(),
      }),
      description: "Checkbox with a label.",
    },
    Link: {
      props: z.object({
        text: z.string(),
        href: z.string().nullable(),
      }),
      description: "Inline navigation link.",
    },
  },
  // Interactivity (submit/retry) will use json-render's built-in actions
  // (setState/validateForm) + handlers in a later increment.
  actions: {},
});
