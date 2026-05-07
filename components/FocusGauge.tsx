"use client";

import { cn } from "@/lib/cn";
import type { FocusSampleState } from "@/lib/types";

const stateRing: Record<FocusSampleState, string> = {
  focused: "text-primary",
  drifting: "text-accent",
  distracted: "text-alert",
  away: "text-muted",
  sleeping: "text-slate-400 dark:text-slate-500",
};

export function FocusGauge({
  value,
  state,
}: {
  value: number;
  state: FocusSampleState;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const offset = c * (1 - pct / 100);

  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
      <svg className="-rotate-90 transform" width="160" height="160" aria-hidden>
        <circle
          cx="80"
          cy="80"
          r={r}
          stroke="currentColor"
          strokeWidth="10"
          fill="none"
          className="text-primary-soft"
        />
        <circle
          cx="80"
          cy="80"
          r={r}
          stroke="currentColor"
          strokeWidth="10"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all duration-300", stateRing[state])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-3xl font-semibold tabular-nums text-text">{value}</p>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          focus
        </p>
      </div>
    </div>
  );
}
