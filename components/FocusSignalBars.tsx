"use client";

import { Eye, ScanFace } from "lucide-react";

export function FocusSignalBars({
  eyesScore,
  faceScore,
}: {
  eyesScore: number;
  faceScore: number;
}) {
  const e = Math.min(100, Math.max(0, eyesScore));
  const f = Math.min(100, Math.max(0, faceScore));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-white/55 bg-white/[0.28] p-3 backdrop-blur-xl backdrop-saturate-200 dark:border-white/[0.16] dark:bg-slate-900/[0.36]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary dark:text-cyan-300">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Eyes
          </span>
          <span className="tabular-nums text-xs font-semibold text-text">{e}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full border border-white/25 bg-white/50 backdrop-blur-sm dark:border-white/[0.06] dark:bg-slate-800/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-500 transition-[width] duration-200 dark:from-cyan-400 dark:to-primary"
            style={{ width: `${e}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-muted">
          Blink &amp; openness (EAR) — keeps the score honest when you look away.
        </p>
      </div>
      <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/[0.12] p-3 backdrop-blur-xl backdrop-saturate-200 dark:border-emerald-400/25 dark:bg-emerald-950/40">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-success dark:text-emerald-300">
            <ScanFace className="h-3.5 w-3.5" aria-hidden />
            Face
          </span>
          <span className="tabular-nums text-xs font-semibold text-text">{f}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full border border-white/25 bg-white/50 backdrop-blur-sm dark:border-white/[0.06] dark:bg-slate-800/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-success to-teal-500 transition-[width] duration-200 dark:from-emerald-400 dark:to-teal-400"
            style={{ width: `${f}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-muted">
          Head yaw &amp; tilt toward the camera — included in the blend with eyes.
        </p>
      </div>
    </div>
  );
}
