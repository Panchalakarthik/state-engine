"use client";

import {
  Component,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { evalComponent } from "@/lib/renderer";
import { bladeScope } from "@/lib/blade-scope";
import type { ResponsiveMode } from "@/lib/types";

interface CanvasProps {
  jsx: string | null;
  responsiveMode: ResponsiveMode;
  isGenerating?: boolean;
  onRenderError?: (error: string) => void;
  externalError?: string | null;
}

const FRAME_WIDTH: Record<ResponsiveMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

/** Catches render-time errors thrown by generated Blade components. */
class RenderBoundary extends Component<
  { children: ReactNode; onError: (msg: string) => void; jsx: string },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("Canvas render error:", error.message);
    console.error("Failing JSX:\n", this.props.jsx);
    this.props.onError(error.message);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function Canvas({ jsx, responsiveMode, isGenerating, onRenderError, externalError }: CanvasProps) {
  const [Comp, setComp] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleError = (msg: string) => {
    if (onRenderError) {
      onRenderError(msg);
    } else {
      setError(msg);
    }
  };

  useEffect(() => {
    if (!jsx) {
      setComp(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setComp(null);

    evalComponent(jsx, bladeScope)
      .then((C) => {
        if (!cancelled) setComp(() => C);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Canvas compile error:", err);
        console.error("Failing JSX:\n", jsx);
        handleError(err?.message ?? "Failed to compile component");
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsx]);

  // Show loading only when the specific active state hasn't arrived yet.
  // Once a state's JSX is available, render it immediately — even if other
  // states are still being generated in parallel.
  if (isGenerating && !jsx) {
    return (
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0d0d0d]">
        <DotGrid />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <p className="text-sm text-[#666]">AI is generating</p>
          <BouncingDots />
        </div>
      </div>
    );
  }

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

  const displayError = externalError ?? error;
  if (displayError) {
    return (
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0d0d0d]">
        <DotGrid />
        <div className="relative z-10 max-w-md text-center">
          <p className="mb-2 text-sm text-[#f87171]">Render error</p>
          <pre className="whitespace-pre-wrap text-xs text-[#555]">{displayError}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-auto bg-white">
      <div
        className="relative z-10 my-6 w-full px-6 transition-all"
        style={{ maxWidth: FRAME_WIDTH[responsiveMode] }}
      >
        {Comp && (
          <RenderBoundary key={jsx} onError={handleError} jsx={jsx ?? ""}>
            <Comp />
          </RenderBoundary>
        )}
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

function BouncingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[#444]"
          style={{
            animation: "bounce 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
