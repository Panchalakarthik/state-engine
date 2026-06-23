"use client";

import { useState } from "react";
import type { Scenario, StateOutput, ResponsiveMode } from "@/lib/types";
import RightHeader from "./right-header";
import Canvas from "./canvas";

interface RightPanelProps {
  scenarios: Scenario[];
  states: Record<string, StateOutput>;
  activeState: string;
  onStateChange: (state: string) => void;
  onExport: () => void;
}

export default function RightPanel({
  scenarios,
  states,
  activeState,
  onStateChange,
  onExport,
}: RightPanelProps) {
  const [responsiveMode, setResponsiveMode] =
    useState<ResponsiveMode>("desktop");
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
      <Canvas jsx={activeJsx} responsiveMode={responsiveMode} />
    </div>
  );
}
