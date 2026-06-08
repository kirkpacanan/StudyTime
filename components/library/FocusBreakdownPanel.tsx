"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Moon,
  ScanFace,
  Smartphone,
  EyeOff,
  ArrowDown,
  Coffee,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { FocusFrameResult } from "@/lib/focus-detection";
import type { FocusSampleState } from "@/lib/types";

const SLEEP_ALARM_MS = 10_000;

type FocusFlags = {
  phoneDetected?: boolean;
  lookingAway?: boolean;
  headDown?: boolean;
  eyesClosed?: boolean;
  hasFace?: boolean;
};

type FocusBreakdownPanelProps = {
  sample: FocusFrameResult;
  flags?: FocusFlags;
  phase: "focus" | "break";
  paused: boolean;
  phoneDetectionEnabled: boolean;
  eyesClosedMs?: number;
  alarmRunning?: boolean;
};

function stateLabel(state: FocusSampleState): string {
  if (state === "focused") return "Locked in";
  if (state === "drifting") return "Drifting";
  if (state === "sleeping") return "Drowsy";
  if (state === "away") return "Away";
  return "Distracted";
}

function ringColor(state: FocusSampleState, phase: "focus" | "break") {
  if (phase === "break") return "text-emerald-400";
  if (state === "focused") return "text-sky-400";
  if (state === "drifting") return "text-amber-400";
  return "text-red-400";
}

function ProgressRing({
  value,
  size,
  stroke,
  colorClass,
  trackClass = "text-slate-700/80",
  children,
}: {
  value: number;
  size: number;
  stroke: number;
  colorClass: string;
  trackClass?: string;
  children: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const offset = circ * (1 - pct / 100);
  const c = size / 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} aria-hidden>
        <circle
          cx={c}
          cy={c}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          className={trackClass}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-[stroke-dashoffset] duration-700 ease-out", colorClass)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function StatBar({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
        <span>{label}</span>
        <span className="tabular-nums text-white">{v}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", colorClass)}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

export function FocusBreakdownPanel({
  sample,
  flags,
  phase,
  paused,
  phoneDetectionEnabled,
  eyesClosedMs = 0,
  alarmRunning = false,
}: FocusBreakdownPanelProps) {
  const [minimized, setMinimized] = useState(false);
  const [displayScore, setDisplayScore] = useState(Math.round(sample.score));

  // Smooth displayed score — updates every ~800ms to reduce visual noise
  useEffect(() => {
    const target = Math.round(sample.score);
    const id = window.setTimeout(() => setDisplayScore(target), 400);
    return () => clearTimeout(id);
  }, [sample.score]);

  const sleepPct = useMemo(
    () => Math.min(100, (eyesClosedMs / SLEEP_ALARM_MS) * 100),
    [eyesClosedMs],
  );
  const sleepSecs = (eyesClosedMs / 1000).toFixed(1);
  const sleepRemaining = Math.max(0, (SLEEP_ALARM_MS - eyesClosedMs) / 1000).toFixed(1);

  const alerts = [
    flags?.phoneDetected && phoneDetectionEnabled
      ? { icon: <Smartphone className="h-3 w-3" />, label: "Phone", tone: "text-red-300 bg-red-500/15 border-red-500/30" }
      : null,
    flags?.lookingAway
      ? { icon: <EyeOff className="h-3 w-3" />, label: "Away", tone: "text-amber-300 bg-amber-500/15 border-amber-500/30" }
      : null,
    flags?.headDown
      ? { icon: <ArrowDown className="h-3 w-3" />, label: "Head down", tone: "text-amber-300 bg-amber-500/15 border-amber-500/30" }
      : null,
    flags?.eyesClosed
      ? { icon: <Eye className="h-3 w-3" />, label: "Eyes closed", tone: "text-red-300 bg-red-500/15 border-red-500/30" }
      : null,
    alarmRunning
      ? { icon: <Moon className="h-3 w-3" />, label: "Wake up!", tone: "text-red-200 bg-red-600/30 border-red-400/50 animate-pulse" }
      : null,
  ].filter(Boolean) as { icon: React.ReactNode; label: string; tone: string }[];

  const focusRingColor = ringColor(sample.state, phase);

  if (phase === "break") {
    return (
      <div className="library-glass-panel fixed right-4 top-24 z-[60] w-44 border-emerald-500/20 p-3">
        <div className="flex flex-col items-center gap-2 text-center">
          <ProgressRing value={100} size={88} stroke={6} colorClass="text-emerald-400">
            <Coffee className="h-5 w-5 text-emerald-400" />
            <span className="text-[10px] font-semibold text-emerald-300">Break</span>
          </ProgressRing>
          <p className="text-[10px] text-slate-400">Focus tracking paused</p>
        </div>
      </div>
    );
  }

  if (minimized) {
    return (
      <div className="library-glass-panel fixed right-4 top-24 z-[60] flex flex-col items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
          aria-label="Expand focus panel"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <ProgressRing value={displayScore} size={72} stroke={5} colorClass={focusRingColor}>
          <span className="text-lg font-bold tabular-nums text-white">{displayScore}</span>
          <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">Focus</span>
        </ProgressRing>
        <ProgressRing
          value={sleepPct}
          size={52}
          stroke={4}
          colorClass={sleepPct > 60 ? "text-red-400" : sleepPct > 20 ? "text-amber-400" : "text-slate-500"}
        >
          <Moon className={cn("h-3 w-3", sleepPct > 20 ? "text-amber-300" : "text-slate-500")} />
          <span className="text-[8px] tabular-nums text-slate-400">
            {eyesClosedMs > 300 ? `${sleepSecs}s` : "Sleep"}
          </span>
        </ProgressRing>
      </div>
    );
  }

  return (
    <div className="library-glass-panel fixed right-4 top-24 z-[60] w-52">
      {/* Header */}
      <div className="library-glass-header flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Focus
        </span>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
              sample.state === "focused"
                ? "bg-sky-500/20 text-sky-300"
                : sample.state === "drifting"
                ? "bg-amber-500/20 text-amber-300"
                : "bg-red-500/20 text-red-300",
            )}
          >
            {paused ? "Paused" : stateLabel(sample.state)}
          </span>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
            aria-label="Minimize focus panel"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 px-3 py-4">
        {/* Main focus ring */}
        <ProgressRing value={displayScore} size={100} stroke={7} colorClass={focusRingColor}>
          <span className="text-2xl font-bold tabular-nums text-white">{displayScore}%</span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
            Focus
          </span>
        </ProgressRing>

        {/* Sleep watch ring */}
        <div className="flex w-full items-center gap-3">
          <ProgressRing
            value={sleepPct}
            size={64}
            stroke={5}
            colorClass={
              alarmRunning
                ? "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                : sleepPct > 50
                ? "text-amber-400"
                : "text-violet-400/70"
            }
          >
            <Moon className={cn("h-3.5 w-3.5", sleepPct > 20 ? "text-amber-300" : "text-violet-300")} />
            <span className="text-[9px] tabular-nums font-semibold text-slate-300">
              {eyesClosedMs > 200 ? `${sleepSecs}s` : "0s"}
            </span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">
              Sleep watch
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
              {alarmRunning
                ? "Alarm active — wake up!"
                : eyesClosedMs > 200
                ? `${sleepRemaining}s until alarm`
                : "Tracks closed eyes · alarm at 10s"}
            </p>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="w-full space-y-2.5 border-t border-white/8 pt-3 backdrop-blur-sm">
          <StatBar label="Eyes" value={sample.eyesScore} colorClass="bg-gradient-to-r from-cyan-400 to-sky-500" />
          <StatBar label="Face" value={sample.faceScore} colorClass="bg-gradient-to-r from-emerald-400 to-teal-500" />
        </div>

        {alerts.length > 0 && (
          <div className="flex w-full flex-wrap gap-1 border-t border-white/8 pt-2">
            {alerts.map((a) => (
              <span
                key={a.label}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
                  a.tone,
                )}
              >
                {a.icon}
                {a.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
