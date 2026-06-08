"use client";

import { useMemo, useState } from "react";
import { Timer, Play, Pause, Square, Coffee, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { LibraryIconButton, LibraryPanelHeader } from "./SessionChrome";

type Phase = "focus" | "break";

type SessionTimerPanelProps = {
  running: boolean;
  paused: boolean;
  phase: Phase;
  remainingSec: number;
  phaseTotalSec: number;
  focusCompleted: number;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
};

const PANEL_W_MIN = 84;

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SessionTimerPanel({
  running,
  paused,
  phase,
  remainingSec,
  phaseTotalSec,
  focusCompleted,
  onPause,
  onResume,
  onEnd,
}: SessionTimerPanelProps) {
  const [minimized, setMinimized] = useState(false);

  const phaseProgress = useMemo(() => {
    if (!running || !phaseTotalSec) return 0;
    return Math.min(100, Math.max(0, ((phaseTotalSec - remainingSec) / phaseTotalSec) * 100));
  }, [running, phaseTotalSec, remainingSec]);

  const R = minimized ? 28 : 40;
  const ringSize = minimized ? 72 : 104;
  const circ = 2 * Math.PI * R;
  const offset = circ * (1 - phaseProgress / 100);

  const phaseLabel =
    phase === "focus"
      ? paused
        ? "Paused"
        : "Focus block"
      : paused
        ? "Paused"
        : "Break";

  const ringColor = phase === "focus" ? "text-cyan-400/90" : "text-emerald-400/90";

  if (minimized) {
    return (
      <div
        className="library-glass-panel pointer-events-auto ml-auto overflow-hidden shadow-2xl transition-[width] duration-200 ease-out"
        style={{ width: PANEL_W_MIN }}
      >
        <LibraryPanelHeader
          icon={<Timer className="h-3 w-3 shrink-0 text-cyan-300/90" />}
          title=""
          actions={
            <LibraryIconButton label="Expand timer panel" onClick={() => setMinimized(false)}>
              <ChevronDown className="h-3 w-3" />
            </LibraryIconButton>
          }
        />
        <div className="flex flex-col items-center gap-1.5 px-2 pb-2.5 pt-1">
          <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
            <svg className="-rotate-90" width={ringSize} height={ringSize} aria-hidden>
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={R}
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                className="text-white/[0.06]"
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={R}
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className={cn("transition-[stroke-dashoffset] duration-1000 ease-out", ringColor)}
              />
            </svg>
            <span className="absolute text-sm font-semibold tabular-nums text-slate-50">
              {running ? fmt(remainingSec) : "--:--"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="library-glass-panel pointer-events-auto w-full overflow-hidden shadow-2xl">
      <LibraryPanelHeader
        icon={<Timer className="h-3 w-3 shrink-0 text-cyan-300/90" />}
        title="Timer"
        subtitle={phaseLabel}
        actions={
          <LibraryIconButton label="Minimize timer panel" onClick={() => setMinimized(true)}>
            <ChevronUp className="h-3 w-3" />
          </LibraryIconButton>
        }
      />

      <div className="flex flex-col items-center gap-2.5 px-3 pb-3.5 pt-2.5">
        <div className="flex items-center gap-1.5">
          {phase === "focus" ? (
            <span className="library-glass-badge flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-sky-100">
              <span className="h-1 w-1 animate-pulse rounded-full bg-sky-400" />
              Focus
            </span>
          ) : (
            <span className="library-glass-badge flex items-center gap-1 border-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
              <Coffee className="h-2.5 w-2.5" />
              Break
            </span>
          )}
          {focusCompleted > 0 && (
            <span className="text-[10px] tabular-nums text-slate-500">×{focusCompleted}</span>
          )}
        </div>

        <div className="relative flex h-[6.5rem] w-[6.5rem] items-center justify-center">
          <svg className="-rotate-90" width={ringSize} height={ringSize} aria-hidden>
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={R}
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              className="text-white/[0.06]"
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={R}
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={cn("transition-[stroke-dashoffset] duration-1000 ease-out", ringColor)}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500">
              {running ? (paused ? "Paused" : phase === "focus" ? "Focus" : "Break") : "Ready"}
            </span>
            <span className="text-xl font-semibold tabular-nums tracking-tight text-slate-50">
              {running ? fmt(remainingSec) : "--:--"}
            </span>
          </div>
        </div>

        {running && (
          <div className="flex gap-1.5">
            <button
              onClick={paused ? onResume : onPause}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition-all",
                paused
                  ? "bg-sky-500/12 text-sky-200 ring-sky-400/25 hover:bg-sky-500/20"
                  : "bg-white/[0.04] text-slate-300 ring-white/[0.08] hover:bg-white/[0.08]",
              )}
              aria-label={paused ? "Resume" : "Pause"}
            >
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onEnd}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-200 ring-1 ring-red-500/25 transition-all hover:bg-red-500/18"
              aria-label="End session"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
