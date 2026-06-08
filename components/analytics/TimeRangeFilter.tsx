"use client";

import { cn } from "@/lib/cn";
import { RANGE_OPTIONS, type RangePreset } from "@/lib/analytics";

export type CustomRange = { start: string; end: string };

/**
 * Segmented preset selector + inline custom date range. Purely controlled:
 * the page owns the selected preset and custom dates and recomputes analytics.
 */
export function TimeRangeFilter({
  preset,
  custom,
  onPresetChange,
  onCustomChange,
}: {
  preset: RangePreset;
  custom: CustomRange;
  onPresetChange: (p: RangePreset) => void;
  onCustomChange: (c: CustomRange) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-wrap gap-1.5 rounded-2xl border border-white/55 bg-white/[0.3] p-1.5 backdrop-blur-xl backdrop-saturate-200 dark:border-white/[0.14] dark:bg-slate-900/[0.34]"
        role="group"
        aria-label="Time range"
      >
        {RANGE_OPTIONS.map((opt) => {
          const active = opt.value === preset;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onPresetChange(opt.value)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "bg-primary text-white shadow-[0_8px_20px_-8px_rgba(79,134,247,0.6)]"
                  : "text-muted hover:bg-white/50 hover:text-text dark:hover:bg-white/[0.08]",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {preset === "custom" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2 text-muted">
            From
            <input
              type="date"
              max={custom.end || today}
              value={custom.start}
              onChange={(e) =>
                onCustomChange({ ...custom, start: e.target.value })
              }
              className="rounded-lg border border-white/55 bg-white/60 px-2.5 py-1.5 text-text outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/[0.14] dark:bg-slate-900/50"
            />
          </label>
          <label className="flex items-center gap-2 text-muted">
            To
            <input
              type="date"
              min={custom.start}
              max={today}
              value={custom.end}
              onChange={(e) =>
                onCustomChange({ ...custom, end: e.target.value })
              }
              className="rounded-lg border border-white/55 bg-white/60 px-2.5 py-1.5 text-text outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/[0.14] dark:bg-slate-900/50"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
