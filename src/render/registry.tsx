// The resolver: maps each catalog type to the real Blade component.
"use client";

import {
  Box,
  Card,
  CardBody,
  Heading,
  Text,
  Alert,
  Badge,
  Skeleton,
  Button,
  Divider,
  TextInput,
  PasswordInput,
  Checkbox,
  Link,
} from "@razorpay/blade/components";
import type { ComponentProps } from "react";
import { defineRegistry, useBoundProp } from "@json-render/react";
import { bladeCatalog } from "./catalog";

// Drop null/undefined so Blade falls back to its own defaults.
function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

export const { registry } = defineRegistry(bladeCatalog, {
  components: {
    Box: ({ props, children }) => (
      <Box {...(clean(props) as ComponentProps<typeof Box>)}>{children}</Box>
    ),
    Card: ({ props, children }) => (
      <Card {...(clean(props) as ComponentProps<typeof Card>)}>
        <CardBody>{children}</CardBody>
      </Card>
    ),
    Divider: () => <Divider />,
    Heading: ({ props }) => (
      <Heading size={props.size ?? "medium"}>{props.text}</Heading>
    ),
    Text: ({ props }) => (
      <Text size={props.size ?? "medium"} weight={props.weight ?? "regular"}>
        {props.text}
      </Text>
    ),
    Alert: ({ props }) => (
      <Alert
        description={props.description}
        title={props.title ?? undefined}
        color={props.color ?? "information"}
        isDismissible={false}
      />
    ),
    Badge: ({ props }) => (
      <Badge color={props.color ?? "neutral"} size={props.size ?? "medium"}>
        {props.text}
      </Badge>
    ),
    Skeleton: ({ props }) => (
      <Skeleton
        {...(clean({
          width: props.width ?? "100%",
          height: props.height ?? "16px",
          borderRadius: props.borderRadius,
        }) as ComponentProps<typeof Skeleton>)}
      />
    ),
    Button: ({ props, emit }) => (
      <Button
        variant={props.variant ?? "primary"}
        isFullWidth={props.isFullWidth ?? false}
        isDisabled={props.isDisabled ?? false}
        isLoading={props.isLoading ?? false}
        onClick={() => emit("press")}
      >
        {props.text}
      </Button>
    ),
    TextInput: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value);
      return (
        <TextInput
          label={props.label}
          placeholder={props.placeholder ?? undefined}
          value={(value as string) ?? ""}
          onChange={(e) => setValue(e.value ?? "")}
          validationState={props.validationState ?? "none"}
          isDisabled={props.isDisabled ?? false}
        />
      );
    },
    PasswordInput: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value);
      return (
        <PasswordInput
          label={props.label}
          placeholder={props.placeholder ?? undefined}
          value={(value as string) ?? ""}
          onChange={(e) => setValue(e.value ?? "")}
          validationState={props.validationState ?? "none"}
          isDisabled={props.isDisabled ?? false}
        />
      );
    },
    Checkbox: ({ props }) => (
      <Checkbox isDisabled={props.isDisabled ?? false}>{props.label}</Checkbox>
    ),
    Link: ({ props }) => (
      <Link href={props.href ?? "#"}>{props.text}</Link>
    ),
  },
});
