// SMOKE TEST ONLY — the "resolver": maps catalog types to real Blade components.
"use client";

import { defineRegistry, useBoundProp } from "@json-render/react";
import { Box, Alert, TextInput, Button } from "@razorpay/blade/components";
import { smokeCatalog } from "./catalog";

export const { registry } = defineRegistry(smokeCatalog, {
  components: {
    Stack: ({ children }) => (
      <Box
        display="flex"
        flexDirection="column"
        gap="spacing.5"
        padding="spacing.6"
      >
        {children}
      </Box>
    ),
    Alert: ({ props }) => (
      <Alert
        description={props.description}
        color={props.color ?? "information"}
        title={props.title ?? undefined}
        isDismissible={false}
      />
    ),
    TextInput: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value);
      return (
        <TextInput
          label={props.label}
          placeholder={props.placeholder ?? undefined}
          value={(value as string) ?? ""}
          onChange={(e) => setValue(e.value ?? "")}
        />
      );
    },
    Button: ({ props, emit }) => (
      <Button
        variant={props.variant ?? "primary"}
        isDisabled={props.isDisabled ?? false}
        onClick={() => emit("press")}
      >
        {props.label}
      </Button>
    ),
  },
});
