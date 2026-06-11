"use client";

import { Square, Timer } from "lucide-react";
import { LibraryPanelHeader } from "./SessionChrome";

type ActivitySessionPanelProps = {
  elapsedSec: number;
  onEnd: () => void;
  endDisabled?: boolean;
};

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ActivitySessionPanel({
  elapsedSec,
  onEnd,
  endDisabled = false,
}: ActivitySessionPanelProps) {
  return (
    <div className="library-glass-panel pointer-events-auto ml-auto overflow-hidden shadow-2xl">
      <LibraryPanelHeader
        icon={<Timer className="h-3 w-3 shrink-0 text-emerald-300/90" />}
        title="Activity"
        subtitle="In progress"
      />
      <div className="flex flex-col items-center gap-3 px-3 pb-3 pt-1">
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500">
            Elapsed
          </span>
          <span className="text-xl font-semibold tabular-nums tracking-tight text-slate-50">
            {fmt(elapsedSec)}
          </span>
        </div>
        <button
          type="button"
          onClick={onEnd}
          disabled={endDisabled}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/12 px-3 py-2 text-xs font-semibold text-red-200 ring-1 ring-red-500/25 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          <Square className="h-3.5 w-3.5" />
          End activity
        </button>
      </div>
    </div>
  );
}
