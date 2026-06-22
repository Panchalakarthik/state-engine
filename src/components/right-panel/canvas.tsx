"use client";

import { useEffect, useRef, useState } from "react";
import React from "react";
import ReactDOM from "react-dom/client";
import { evalComponent } from "@/lib/renderer";
import { bladeScope } from "@/lib/blade-scope";
import type { ResponsiveMode } from "@/lib/types";

interface CanvasProps {
  jsx: string | null;
  responsiveMode: ResponsiveMode;
}

const FRAME_WIDTH: Record<ResponsiveMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

export default function Canvas({ jsx, responsiveMode }: CanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReactDOM.Root | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jsx || !mountRef.current) return;
    let cancelled = false;
    setError(null);

    evalComponent(jsx, bladeScope)
      .then((Component) => {
        if (cancelled || !mountRef.current) return;
        if (!rootRef.current) {
          rootRef.current = ReactDOM.createRoot(mountRef.current);
        }
        rootRef.current.render(React.createElement(Component));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Canvas render error:", err);
        setError(err?.message ?? "Failed to render component");
      });

    return () => {
      cancelled = true;
    };
  }, [jsx]);

  useEffect(() => {
    return () => {
      // Unmount asynchronously to avoid React "synchronous unmount during render"
      const root = rootRef.current;
      rootRef.current = null;
      if (root) setTimeout(() => root.unmount(), 0);
    };
  }, []);

  if (!jsx) {
    return (
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0d0d0d]">
        <DotGrid />
        <p className="relative z-10 text-sm text-[#333]">
          Enter a screen name to generate states
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0d0d0d]">
        <DotGrid />
        <div className="relative z-10 max-w-md text-center">
          <p className="mb-2 text-sm text-[#f87171]">Render error</p>
          <pre className="whitespace-pre-wrap text-xs text-[#555]">{error}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-auto bg-[#0d0d0d]">
      <DotGrid />
      <div
        className="relative z-10 my-6 w-full transition-all"
        style={{ maxWidth: FRAME_WIDTH[responsiveMode] }}
      >
        <div ref={mountRef} className="px-6" />
      </div>
    </div>
  );
}

function DotGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-50"
      style={{
        backgroundImage:
          "radial-gradient(circle, #1a2030 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    />
  );
}
