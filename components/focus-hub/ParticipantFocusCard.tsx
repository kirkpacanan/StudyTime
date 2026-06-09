"use client";

import { cn } from "@/lib/cn";
import type { ParticipantLiveState } from "@/lib/focus-hub/types";
import { stateLabel } from "@/hooks/useFocusHubRoom";
import { AlertTriangle, Clock } from "lucide-react";

type ParticipantFocusCardProps = {
  participant: ParticipantLiveState;
};

function focusColorClass(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function focusBarClass(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function focusBorderClass(score: number, flagged: boolean): string {
  if (flagged) return "border-red-500/50 bg-red-500/5";
  if (score >= 70) return "border-emerald-500/20 bg-emerald-500/5";
  if (score >= 50) return "border-yellow-500/20 bg-yellow-500/5";
  return "border-red-500/30 bg-red-500/8";
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ParticipantFocusCard({ participant }: ParticipantFocusCardProps) {
  const { name, avatarUrl, score, state, flagged } = participant;

  return (
    <div
      className={cn(
        "relative rounded-2xl border p-4 transition-all duration-300",
        focusBorderClass(score, flagged),
      )}
    >
      {/* Flag indicator */}
      {flagged && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
          <AlertTriangle className="h-3 w-3" />
          Flagged
        </div>
      )}

      {/* Avatar + name */}
      <div className="mb-3 flex items-center gap-2.5">
        <div className="relative h-9 w-9 shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="h-9 w-9 rounded-full object-cover ring-2 ring-[var(--cc-border)]"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary ring-2 ring-[var(--cc-border)]">
              {initials(name)}
            </div>
          )}
          {/* Online dot */}
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--cc-surface)] bg-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{name}</p>
          <p className="text-[11px] text-muted">{stateLabel(state)}</p>
        </div>
      </div>

      {/* Focus score */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted">Focus Score</p>
          <p className={cn("text-2xl font-bold tabular-nums", focusColorClass(score))}>
            {score}<span className="text-sm font-normal text-muted">%</span>
          </p>
        </div>
        <Clock className="h-4 w-4 text-muted" />
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all duration-700", focusBarClass(score))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
