"use client";

import { memo } from "react";
import type { FocusFrameResult } from "@/lib/focus-detection";
import type { FocusSensitivity } from "@/lib/types";
import { FocusCameraPanel } from "./FocusCameraPanel";
import { FocusBreakdownPanel } from "./FocusBreakdownPanel";
import { SessionTimerPanel } from "./SessionTimerPanel";

type LiveFocusFlags = {
  phoneDetected?: boolean;
  lookingAway?: boolean;
  headDown?: boolean;
  eyesClosed?: boolean;
  hasFace?: boolean;
};

type SessionPanelsLayerProps = {
  webcamEnabled: boolean;
  active: boolean;
  phoneDetectionEnabled: boolean;
  focusThreshold: number;
  distractionThreshold: number;
  focusSensitivity?: FocusSensitivity;
  deskWorkBias?: boolean;
  onSample: (sample: FocusFrameResult) => void;
  running: boolean;
  paused: boolean;
  phase: "focus" | "break";
  remainingSec: number;
  phaseTotalSec: number;
  focusCompleted: number;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  sample: FocusFrameResult;
  flags: LiveFocusFlags;
  eyesClosedMs: number;
  alarmRunning: boolean;
  /** `embedded` — session card inside app shell; `immersive` — fullscreen overlay. */
  layout?: "embedded" | "immersive";
};

const PANEL_TOP = {
  embedded: { vision: "top-14 sm:top-16", timer: "top-[4.25rem] sm:top-[4.75rem]" },
  immersive: { vision: "top-[5.5rem]", timer: "top-[6rem]" },
} as const;
/** Shared right-column width — matches Focus panel. */
const RIGHT_COL_W = 196;

/**
 * Study panels — fixed layout above the 3D scene.
 *
 * Camera:        top-left, below the room info pill
 * Focus + Timer: top-right column, same inset as Exit (right-4), snug stack
 *
 * Wrapped in React.memo so the panel tree only re-renders when its own props
 * change, not on every unrelated SessionPage state update.
 */
export const SessionPanelsLayer = memo(function SessionPanelsLayer(props: SessionPanelsLayerProps) {
  const layout = props.layout ?? "immersive";
  const tops = PANEL_TOP[layout];

  return (
    <>
      {/* Live Vision — top-left */}
      <div className={`pointer-events-none absolute left-3 z-10 sm:left-4 ${tops.vision}`}>
        <FocusCameraPanel
          enabled={props.webcamEnabled}
          active={props.active}
          phoneDetectionEnabled={props.phoneDetectionEnabled}
          focusThreshold={props.focusThreshold}
          distractionThreshold={props.distractionThreshold}
          focusSensitivity={props.focusSensitivity}
          deskWorkBias={props.deskWorkBias}
          onSample={props.onSample}
        />
      </div>

      {/* Focus + Timer — top-right column */}
      <div
        className={`pointer-events-none absolute right-3 z-20 flex flex-col gap-2 sm:right-4 ${tops.timer}`}
        style={{ width: RIGHT_COL_W }}
      >
        <FocusBreakdownPanel
          sample={props.sample}
          flags={props.flags}
          phase={props.phase}
          paused={props.paused}
          phoneDetectionEnabled={props.phoneDetectionEnabled}
          eyesClosedMs={props.eyesClosedMs}
          alarmRunning={props.alarmRunning}
        />
        <SessionTimerPanel
          running={props.running}
          paused={props.paused}
          phase={props.phase}
          remainingSec={props.remainingSec}
          phaseTotalSec={props.phaseTotalSec}
          focusCompleted={props.focusCompleted}
          onPause={props.onPause}
          onResume={props.onResume}
          onEnd={props.onEnd}
        />
      </div>
    </>
  );
});
