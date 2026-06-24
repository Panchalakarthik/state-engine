"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Scenario, StateOutput, ResponsiveMode } from "@/lib/types";
import RightHeader from "./right-header";
import Canvas from "./canvas";

interface RightPanelProps {
  scenarios: Scenario[];
  states: Record<string, StateOutput>;
  activeState: string;
  isGenerating: boolean;
  onStateChange: (state: string) => void;
  onExport: () => void;
  onStateFixed: (scenarioName: string, jsx: string) => void;
}

const MAX_RETRIES = 2;

export default function RightPanel({
  scenarios,
  states,
  activeState,
  isGenerating,
  onStateChange,
  onExport,
  onStateFixed,
}: RightPanelProps) {
  const [responsiveMode, setResponsiveMode] = useState<ResponsiveMode>("desktop");
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const retryCountRef = useRef<Map<string, number>>(new Map());

  // Reset retry state when the active scenario changes
  useEffect(() => {
    setRetryError(null);
    setIsRetrying(false);
  }, [activeState]);

  const handleRenderError = useCallback(
    async (error: string) => {
      const retries = retryCountRef.current.get(activeState) ?? 0;
      if (retries >= MAX_RETRIES) {
        setRetryError(error);
        return;
      }
      retryCountRef.current.set(activeState, retries + 1);
      setRetryError(null);
      setIsRetrying(true);

      try {
        const protoName = scenarios[0]?.name ?? "prototype";
        const protoJsx = states[protoName]?.jsx ?? states[activeState]?.jsx ?? "";
        const scenario = scenarios.find((s) => s.name === activeState);

        const res = await fetch("/api/fix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prototypeJsx: protoJsx,
            scenarioName: activeState,
            scenarioDescription: scenario?.description ?? activeState,
            error,
          }),
        });

        if (!res.ok) throw new Error(`Fix request failed: ${res.status}`);
        const data = (await res.json()) as { jsx?: string; error?: string };
        if (!data.jsx) throw new Error(data.error ?? "No JSX returned");

        onStateFixed(activeState, data.jsx);
      } catch (err) {
        console.error("Auto-fix failed:", err);
        setRetryError(error);
      } finally {
        setIsRetrying(false);
      }
    },
    [activeState, scenarios, states, onStateFixed],
  );

  const activeJsx = states[activeState]?.jsx ?? null;

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[#0d0d0d]">
      <RightHeader
        scenarios={scenarios}
        activeState={activeState}
        responsiveMode={responsiveMode}
        onResponsiveChange={setResponsiveMode}
        onStateChange={onStateChange}
        onExport={onExport}
      />
      <Canvas
        jsx={isRetrying ? null : activeJsx}
        responsiveMode={responsiveMode}
        isGenerating={isGenerating || isRetrying}
        onRenderError={handleRenderError}
        externalError={retryError}
      />
    </div>
  );
}
