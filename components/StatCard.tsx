import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";

const accentTop: Record<"blue" | "green" | "yellow" | "muted", string> = {
  blue: "from-primary via-sky-500 to-primary",
  green: "from-success via-emerald-400 to-success",
  yellow: "from-accent via-amber-400 to-accent",
  muted:
    "from-slate-300 via-slate-400 to-slate-300 dark:from-slate-600 dark:via-slate-500 dark:to-slate-600",
};

const iconSurface: Record<"blue" | "green" | "yellow" | "muted", string> = {
  blue: "bg-primary/12 text-primary ring-primary/15",
  green: "bg-success/12 text-success ring-success/15",
  yellow:
    "bg-accent/15 text-amber-800 ring-amber-500/20 dark:text-accent dark:ring-accent/25",
  muted: "bg-muted/12 text-muted ring-muted/20",
};

/**
 * Optional period-over-period trend shown under the value.
 * `value` is a signed percent change (null = no comparable baseline).
 * `goodDirection` flips the color semantics for metrics where down is good
 * (e.g. distractions): "up" (default) treats increases as positive.
 */
export type StatTrend = {
  value: number | null;
  label?: string;
  goodDirection?: "up" | "down";
};

function TrendLine({ trend }: { trend: StatTrend }) {
  if (trend.value === null) {
    return (
      <p className="mt-2 flex items-center gap-1 text-xs font-medium text-muted">
        <Minus className="h-3.5 w-3.5" aria-hidden />
        No prior data{trend.label ? ` · ${trend.label}` : ""}
      </p>
    );
  }

  const rounded = Math.round(trend.value);
  const isFlat = rounded === 0;
  const isUp = rounded > 0;
  const good = (trend.goodDirection ?? "up") === "up" ? isUp : !isUp;
  const tone = isFlat
    ? "text-muted"
    : good
      ? "text-success"
      : "text-alert";
  const Icon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <p className={cn("mt-2 flex items-center gap-1 text-xs font-medium", tone)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="tabular-nums">
        {isUp ? "+" : ""}
        {rounded}%
      </span>
      {trend.label ? (
        <span className="text-muted">{trend.label}</span>
      ) : null}
    </p>
  );
}

/** One layout for all KPI tiles: equal min height, type scale, and icon frame. */
export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  accent = "blue",
  trend,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: "blue" | "green" | "yellow" | "muted";
  trend?: StatTrend;
}) {
  return (
    <Card
      className={cn(
        "group relative flex h-full min-h-[12.25rem] w-full min-w-0 flex-col overflow-hidden p-0 transition duration-300 ease-out md:min-h-[12.5rem]",
        "hover:-translate-y-1 hover:shadow-[0_18px_48px_-18px_rgba(79,134,247,0.16)] dark:hover:shadow-[0_24px_56px_-20px_rgba(0,0,0,0.55)]",
      )}
    >
      <div
        className={cn(
          "h-1 w-full shrink-0 bg-gradient-to-r",
          accentTop[accent],
        )}
        aria-hidden
      />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col p-5 md:p-5">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug tracking-tight text-muted">
              {title}
            </p>
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset backdrop-blur-sm transition duration-300 group-hover:scale-[1.04]",
                iconSurface[accent],
              )}
            >
              <Icon
                className="h-5 w-5 shrink-0"
                strokeWidth={2}
                aria-hidden
              />
            </div>
          </div>
          <p className="mt-3 break-words text-3xl font-semibold tabular-nums tracking-tight text-text [overflow-wrap:anywhere]">
            {value}
          </p>
          {trend ? <TrendLine trend={trend} /> : null}
          {hint ? (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
