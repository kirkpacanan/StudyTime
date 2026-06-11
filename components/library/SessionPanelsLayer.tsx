"use client";

import { memo, type MutableRefObject } from "react";
import type { FocusFrameResult } from "@/lib/focus-detection";
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
  onSample: (sample: FocusFrameResult) => void;
  frameCaptureRef?: MutableRefObject<(() => Promise<Blob | null>) | null>;
  running: boolean;
  paused: boolean;
  phase: "focus" | "break";
  remainingSec: number;
  phaseTotalSec: number;
  focusCompleted: number;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  endDisabled?: boolean;
  sample: FocusFrameResult;
  flags: LiveFocusFlags;
  eyesClosedMs: number;
  alarmRunning: boolean;
  /** `embedded` — session card inside app shell; `immersive` — fullscreen overlay. */
  layout?: "embedded" | "immersive";
};

const PANEL_TOP = {
  embedded: { vision: "top-[10.5rem] sm:top-[11rem]", timer: "top-[5rem] sm:top-[5.5rem]" },
  immersive: { vision: "top-[10rem]", timer: "top-[6rem]" },
} as const;
const RIGHT_COL_W = 196;

export const SessionPanelsLayer = memo(function SessionPanelsLayer(props: SessionPanelsLayerProps) {
  const layout = props.layout ?? "immersive";
  const tops = PANEL_TOP[layout];

  return (
    <>
      <div className={`pointer-events-none absolute left-3 z-10 sm:left-4 ${tops.vision}`}>
        <FocusCameraPanel
          enabled={props.webcamEnabled}
          active={props.active}
          phoneDetectionEnabled={props.phoneDetectionEnabled}
          onSample={props.onSample}
          frameCaptureRef={props.frameCaptureRef}
        />
      </div>

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
          endDisabled={props.endDisabled}
        />
      </div>
    </>
  );
});
