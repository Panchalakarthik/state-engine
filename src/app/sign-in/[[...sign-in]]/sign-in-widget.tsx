"use client";

import dynamic from "next/dynamic";

const SignIn = dynamic(
  () => import("@clerk/nextjs").then((m) => ({ default: m.SignIn })),
  { ssr: false, loading: () => null }
);

export default function SignInWidget() {
  return <SignIn />;
}
