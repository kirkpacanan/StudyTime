"use client";

import { useMemo } from "react";
import { Timer, Play, Pause, Square, Coffee } from "lucide-react";
import { cn } from "@/lib/cn";

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
  const phaseProgress = useMemo(() => {
    if (!running || !phaseTotalSec) return 0;
    return Math.min(100, Math.max(0, ((phaseTotalSec - remainingSec) / phaseTotalSec) * 100));
  }, [running, phaseTotalSec, remainingSec]);

  const R = 44;
  const circ = 2 * Math.PI * R;
  const offset = circ * (1 - phaseProgress / 100);

  return (
    <div className="library-glass-panel fixed bottom-4 right-4 z-[60] flex flex-col items-center gap-3 p-4">
      {/* Phase badge */}
      <div className="flex items-center gap-2">
        {phase === "focus" ? (
          <span className="library-glass-badge flex items-center gap-1.5 px-3 py-0.5 text-[11px] font-semibold text-sky-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
            Focus Block
          </span>
        ) : (
          <span className="library-glass-badge flex items-center gap-1.5 border-emerald-500/20 bg-emerald-500/10 px-3 py-0.5 text-[11px] font-semibold text-emerald-200">
            <Coffee className="h-3 w-3" />
            Break
          </span>
        )}
        {focusCompleted > 0 && (
          <span className="text-xs text-slate-400 tabular-nums">×{focusCompleted}</span>
        )}
      </div>

      {/* Circular timer */}
      <div className="relative flex h-28 w-28 items-center justify-center">
        <svg className="-rotate-90" width="112" height="112" aria-hidden>
          <circle
            cx="56"
            cy="56"
            r={R}
            stroke="currentColor"
            strokeWidth="7"
            fill="none"
            className="text-white/10"
          />
          <circle
            cx="56"
            cy="56"
            r={R}
            stroke="currentColor"
            strokeWidth="7"
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn(
              "transition-[stroke-dashoffset] duration-1000 ease-out",
              phase === "focus"
                ? "text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]"
                : "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]",
            )}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            {running ? (paused ? "Paused" : phase === "focus" ? "Focus" : "Break") : "Timer"}
          </span>
          <span className="text-2xl font-bold tabular-nums text-white">
            {running ? fmt(remainingSec) : "--:--"}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {running && (
          <>
            <button
              onClick={paused ? onResume : onPause}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition-all",
                paused
                  ? "border-sky-500/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"
                  : "border-white/15 bg-white/[0.06] text-slate-300 hover:bg-white/12",
              )}
              aria-label={paused ? "Resume" : "Pause"}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button
              onClick={onEnd}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-red-500/35 bg-red-500/15 text-red-300 backdrop-blur-sm transition-all hover:bg-red-500/25"
              aria-label="End session"
            >
              <Square className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <div className="library-glass-footer flex w-full items-center justify-center gap-1.5 border-t-0 bg-transparent py-0">
        <Timer className="h-3 w-3 text-slate-500" />
        Study Timer
      </div>
    </div>
  );
}
