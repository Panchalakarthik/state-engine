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
import {
  defineRegistry,
  useBoundProp,
  useFieldValidation,
} from "@json-render/react";
import { bladeCatalog } from "./catalog";

type ValidationCheck = { type: string; message: string };

// Shared validated input — drives Blade's validationState/errorText from
// json-render's field validation (built-in 'email', 'required', etc.).
function ValidatedInput({
  Comp,
  props,
  bindings,
}: {
  Comp: typeof TextInput | typeof PasswordInput;
  props: {
    label: string;
    placeholder?: string | null;
    value?: unknown;
    validationState?: "none" | "error" | null;
    isDisabled?: boolean | null;
    checks?: ValidationCheck[] | null;
  };
  bindings?: Record<string, string>;
}) {
  const path = bindings?.value ?? "";
  const [value, setValue] = useBoundProp(props.value, bindings?.value);
  const { errors, touch, validate } = useFieldValidation(
    path || "/__novalidate",
    {
      checks: props.checks ?? [],
      validateOn: "change",
    },
  );
  const hasError = props.validationState === "error" || errors.length > 0;
  return (
    <Comp
      label={props.label}
      placeholder={props.placeholder ?? undefined}
      value={(value as string) ?? ""}
      onChange={(e) => {
        setValue(e.value ?? "");
        touch();
        validate();
      }}
      validationState={hasError ? "error" : "none"}
      errorText={errors[0] ?? undefined}
      isDisabled={props.isDisabled ?? false}
    />
  );
}

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
    TextInput: ({ props, bindings }) => (
      <ValidatedInput Comp={TextInput} props={props} bindings={bindings} />
    ),
    PasswordInput: ({ props, bindings }) => (
      <ValidatedInput Comp={PasswordInput} props={props} bindings={bindings} />
    ),
    Checkbox: ({ props }) => (
      <Checkbox isDisabled={props.isDisabled ?? false}>{props.label}</Checkbox>
    ),
    Link: ({ props }) => (
      <Link href={props.href ?? "#"}>{props.text}</Link>
    ),
  },
});
