import type { DayAgg } from "@/lib/reports";
import { Badge } from "@/components/ui/badge";

export function DailyBreakdown({ days }: { days: DayAgg[] }) {
  return (
    <ul className="space-y-2">
      {days.map((d) => (
        <li
          key={d.dateKey}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/55 bg-white/[0.28] px-3 py-2.5 text-sm backdrop-blur-xl backdrop-saturate-200 dark:border-white/[0.16] dark:bg-slate-900/[0.34]"
        >
          <span className="font-medium text-text">{d.label}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{d.studyMinutes} min study</Badge>
            <Badge tone="muted">{d.breakMinutes} min breaks</Badge>
            {d.avgFocus !== null ? (
              <Badge tone="green">{d.avgFocus}% focus</Badge>
            ) : (
              <Badge tone="muted">No sessions</Badge>
            )}
            <span className="text-xs text-muted">
              {d.sessions} session{d.sessions === 1 ? "" : "s"} ·{" "}
              {d.distractionEvents} distraction events
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
