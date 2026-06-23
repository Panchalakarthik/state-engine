// SMOKE TEST ONLY — isolated experiment to validate json-render + Blade.
// Not wired into the main app. Safe to delete.
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

export const smokeCatalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({}),
      description: "Vertical stack container",
    },
    Alert: {
      props: z.object({
        description: z.string(),
        color: z
          .enum(["information", "negative", "neutral", "notice", "positive"])
          .nullable(),
        title: z.string().nullable(),
      }),
      description: "Feedback alert banner",
    },
    TextInput: {
      props: z.object({
        label: z.string(),
        value: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable(),
        placeholder: z.string().nullable(),
      }),
      description: "Text input with optional value binding",
    },
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(["primary", "secondary", "tertiary"]).nullable(),
        isDisabled: z.boolean().nullable(),
      }),
      description: "Clickable button",
    },
  },
  actions: {},
});
