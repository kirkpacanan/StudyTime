"use client";

import { Html } from "@react-three/drei";

export type AvatarStatus = "idle" | "studying" | "break" | "completed";

type StatusBadgeProps = {
  status: AvatarStatus;
  displayName: string;
  focusScore?: number;
  durationMs?: number;
  yOffset?: number;
};

const STATUS_CONFIG: Record<AvatarStatus, { label: string; bg: string; dot: string }> = {
  idle:      { label: "Idle",              bg: "bg-slate-700/90",   dot: "bg-slate-400" },
  studying:  { label: "Studying",          bg: "bg-blue-700/90",    dot: "bg-blue-300" },
  break:     { label: "On Break",          bg: "bg-amber-600/90",   dot: "bg-amber-300" },
  completed: { label: "Session Complete",  bg: "bg-emerald-700/90", dot: "bg-emerald-300" },
};

function fmtDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function StatusBadge({
  status,
  displayName,
  focusScore,
  durationMs,
  yOffset = 2.4,
}: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <Html
      center
      position={[0, yOffset, 0]}
      distanceFactor={8}
      occlude
    >
      <div className="pointer-events-none flex flex-col items-center gap-1" style={{ userSelect: "none" }}>
        {/* Name tag */}
        <div className="rounded-full border border-white/20 bg-black/70 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-md">
          {displayName}
        </div>

        {/* Status chip */}
        <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow ${cfg.bg}`}>
          <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${cfg.dot}`} />
          {cfg.label}
          {focusScore != null && status === "studying" && (
            <span className="ml-1 font-bold tabular-nums">{Math.round(focusScore)}%</span>
          )}
        </div>

        {/* Duration */}
        {durationMs != null && durationMs > 60_000 && (
          <div className="rounded-full bg-black/50 px-2 py-0.5 text-[9px] text-white/70 backdrop-blur-sm">
            {fmtDuration(durationMs)}
          </div>
        )}
      </div>
    </Html>
  );
}
