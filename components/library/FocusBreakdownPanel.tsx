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
import { LibraryIconButton, LibraryPanelHeader } from "./SessionChrome";
import type { FocusSampleState } from "@/lib/types";

const SLEEP_ALARM_MS = 10_000;
const PANEL_W = 196;
const PANEL_W_MIN = 84;

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
  if (phase === "break") return "text-emerald-400/90";
  if (state === "focused") return "text-cyan-400/90";
  if (state === "drifting") return "text-amber-400/90";
  return "text-red-400/90";
}

function ProgressRing({
  value,
  size,
  stroke,
  colorClass,
  trackClass = "text-white/[0.06]",
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
      <div className="flex items-center justify-between text-[9px] font-medium uppercase tracking-wider text-slate-500">
        <span>{label}</span>
        <span className="tabular-nums text-slate-300">{v}%</span>
      </div>
      <div className="h-px overflow-hidden rounded-full bg-white/[0.08]">
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
      ? { icon: <Smartphone className="h-2.5 w-2.5" />, label: "Phone", tone: "text-red-200 bg-red-500/12 border-red-500/20" }
      : null,
    flags?.lookingAway
      ? { icon: <EyeOff className="h-2.5 w-2.5" />, label: "Away", tone: "text-amber-200 bg-amber-500/12 border-amber-500/20" }
      : null,
    flags?.headDown
      ? { icon: <ArrowDown className="h-2.5 w-2.5" />, label: "Head down", tone: "text-amber-200 bg-amber-500/12 border-amber-500/20" }
      : null,
    flags?.eyesClosed
      ? { icon: <Eye className="h-2.5 w-2.5" />, label: "Eyes closed", tone: "text-red-200 bg-red-500/12 border-red-500/20" }
      : null,
    alarmRunning
      ? { icon: <Moon className="h-2.5 w-2.5" />, label: "Wake up!", tone: "text-red-100 bg-red-600/25 border-red-400/35 animate-pulse" }
      : null,
  ].filter(Boolean) as { icon: React.ReactNode; label: string; tone: string }[];

  const focusRingColor = ringColor(sample.state, phase);
  const panelWidth = minimized && phase !== "break" ? PANEL_W_MIN : PANEL_W;

  const statusBadge = (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider ring-1",
        sample.state === "focused"
          ? "bg-cyan-500/15 text-cyan-100 ring-cyan-400/20"
          : sample.state === "drifting"
          ? "bg-amber-500/15 text-amber-100 ring-amber-400/20"
          : "bg-red-500/15 text-red-100 ring-red-400/20",
      )}
    >
      {paused ? "Paused" : stateLabel(sample.state)}
    </span>
  );

  const shrinkRight = minimized && phase !== "break";

  return (
    <div
      className={cn(
        "library-glass-panel pointer-events-auto overflow-hidden transition-[width] duration-200 ease-out",
        shrinkRight ? "ml-auto" : "w-full",
      )}
      style={{ width: shrinkRight ? panelWidth : undefined }}
    >
      {phase === "break" ? (
        <>
          <LibraryPanelHeader
            icon={<Coffee className="h-3 w-3 shrink-0 text-emerald-300/90" />}
            title="Break"
            subtitle="Tracking paused"
          />
          <div className="flex flex-col items-center gap-2 px-3 py-3">
            <ProgressRing value={100} size={72} stroke={3} colorClass="text-emerald-400/90">
              <Coffee className="h-4 w-4 text-emerald-300/90" />
            </ProgressRing>
            <p className="text-[10px] text-slate-500">Rest & recharge</p>
          </div>
        </>
      ) : minimized ? (
        <>
          <LibraryPanelHeader
            icon={<ScanFace className="h-3 w-3 shrink-0 text-cyan-300/90" />}
            title=""
            actions={
              <LibraryIconButton label="Expand focus panel" onClick={() => setMinimized(false)}>
                <ChevronDown className="h-3 w-3" />
              </LibraryIconButton>
            }
          />
          <div className="flex flex-col items-center gap-2 px-2 pb-2.5 pt-1">
            <ProgressRing value={displayScore} size={56} stroke={3} colorClass={focusRingColor}>
              <span className="text-sm font-semibold tabular-nums text-slate-50">{displayScore}</span>
            </ProgressRing>
            <ProgressRing
              value={sleepPct}
              size={40}
              stroke={2}
              colorClass={sleepPct > 60 ? "text-red-400/90" : sleepPct > 20 ? "text-amber-400/90" : "text-slate-500/80"}
            >
              <Moon className={cn("h-2.5 w-2.5", sleepPct > 20 ? "text-amber-300/90" : "text-slate-500")} />
            </ProgressRing>
          </div>
        </>
      ) : (
        <>
          <LibraryPanelHeader
            icon={<ScanFace className="h-3 w-3 shrink-0 text-cyan-300/90" />}
            title="Focus"
            actions={
              <>
                {statusBadge}
                <LibraryIconButton label="Minimize focus panel" onClick={() => setMinimized(true)}>
                  <ChevronUp className="h-3 w-3" />
                </LibraryIconButton>
              </>
            }
          />

          <div className="flex flex-col items-center gap-2.5 px-3 py-3">
            <ProgressRing value={displayScore} size={88} stroke={3} colorClass={focusRingColor}>
              <span className="text-xl font-semibold tabular-nums tracking-tight text-slate-50">
                {displayScore}%
              </span>
            </ProgressRing>

            <div className="flex w-full items-center gap-2.5">
              <ProgressRing
                value={sleepPct}
                size={48}
                stroke={2}
                colorClass={
                  alarmRunning
                    ? "text-red-400/90"
                    : sleepPct > 50
                    ? "text-amber-400/90"
                    : "text-violet-400/60"
                }
              >
                <Moon className={cn("h-2.5 w-2.5", sleepPct > 20 ? "text-amber-300/80" : "text-violet-300/70")} />
                <span className="text-[8px] tabular-nums text-slate-500">
                  {eyesClosedMs > 200 ? `${sleepSecs}s` : "0s"}
                </span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">
                  Sleep watch
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
                  {alarmRunning
                    ? "Alarm active"
                    : eyesClosedMs > 200
                    ? `${sleepRemaining}s left`
                    : "10s threshold"}
                </p>
              </div>
            </div>

            <div className="w-full space-y-2 border-t border-white/[0.06] pt-2.5">
              <StatBar label="Eyes" value={sample.eyesScore} colorClass="bg-cyan-400/80" />
              <StatBar label="Face" value={sample.faceScore} colorClass="bg-emerald-400/80" />
            </div>

            {alerts.length > 0 && (
              <div className="flex w-full flex-wrap gap-1 border-t border-white/[0.06] pt-2">
                {alerts.map((a) => (
                  <span
                    key={a.label}
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide",
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
        </>
      )}
    </div>
  );
}
