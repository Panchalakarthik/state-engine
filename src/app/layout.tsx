import type { Metadata } from "next";
import "./globals.css";
import StyledComponentsRegistry from "./styled-registry";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: "State Engine",
  description: "Derive every UI state from one screen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <StyledComponentsRegistry>
          <Providers>{children}</Providers>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
