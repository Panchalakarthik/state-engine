import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import StyledComponentsRegistry from "./styled-registry";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: "State Engine",
  description: "Derive every UI state from one screen",
  openGraph: {
    title: "State Engine",
    description: "Derive every UI state from one screen",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <ClerkProvider>
          <StyledComponentsRegistry>
            <Providers>{children}</Providers>
          </StyledComponentsRegistry>
        </ClerkProvider>
      </body>
    </html>
  );
}
