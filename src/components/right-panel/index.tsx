"use client";

import { useState } from "react";
import type { StateOutput, ResponsiveMode } from "@/lib/types";
import RightHeader from "./right-header";
import Canvas from "./canvas";

interface RightPanelProps {
  states: Record<string, StateOutput>;
  activeState: string;
  onStateChange: (state: string) => void;
  onExport: () => void;
}

export default function RightPanel({
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
        states={Object.keys(states)}
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
