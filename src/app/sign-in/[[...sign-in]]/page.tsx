import { SignIn } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — State Engine",
  description: "Sign in to access State Engine and derive every UI state from one screen.",
};

const inter = Inter({ subsets: ["latin"] });

export default function Page() {
  return (
    <div className={`${inter.className} flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f5f5]`}>
      <div className="text-center">
        <p className="text-base font-semibold text-[#1a1a1a]">Restrict engine access per user due to API key limitations</p>
        <p className="mt-1 text-sm text-[#5F5F5F]">Sign in to get the full experience</p>
      </div>
      <SignIn />
    </div>
  );
}
