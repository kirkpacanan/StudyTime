"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard, type StatTrend } from "@/components/StatCard";
import {
  DistractionBarChart,
  FocusDistributionChart,
  FocusTrendChart,
} from "@/components/analytics/AnalyticsCharts";
import {
  buildFocusDistribution,
  buildFocusTrend,
  formatHourRange,
  formatMinutesOfDay,
  weekdayLong,
  weekdayShort,
  type AnalyticsBundle,
  type Comparison,
  type Granularity,
  type Insight,
} from "@/lib/analytics";
import type { StudySession } from "@/lib/types";
import { cn } from "@/lib/cn";
import {
  Activity,
  CalendarCheck,
  Clock,
  Flame,
  Gauge,
  Lightbulb,
  PhoneOff,
  Repeat,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
});

function trend(
  comparison: Comparison | null,
  key: keyof Comparison,
  goodDirection: "up" | "down" = "up",
): StatTrend | undefined {
  if (!comparison) return undefined;
  return {
    value: comparison[key],
    label: "vs previous",
    goodDirection,
  };
}

// --------------------------------------------------------------------------- #
// Performance overview — 6 KPI cards with previous-period deltas
// --------------------------------------------------------------------------- #

export function PerformanceOverview({
  analytics,
  currentStreak,
  longestStreak,
}: {
  analytics: AnalyticsBundle;
  currentStreak: number;
  longestStreak: number;
}) {
  const { overview, comparison } = analytics;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        title="Total study time"
        value={`${overview.studyHours.toFixed(1)} h`}
        icon={Clock}
        accent="blue"
        trend={trend(comparison, "studyHours")}
      />
      <StatCard
        title="Average focus score"
        value={`${Math.round(overview.avgFocus)}%`}
        icon={Target}
        accent="green"
        trend={trend(comparison, "avgFocus")}
      />
      <StatCard
        title="Sessions completed"
        value={String(overview.sessionCount)}
        icon={Activity}
        accent="yellow"
        trend={trend(comparison, "sessionCount")}
      />
      <StatCard
        title="Avg session duration"
        value={`${Math.round(overview.avgDurationMin)} min`}
        icon={Gauge}
        accent="blue"
        trend={trend(comparison, "avgDurationMin")}
      />
      <StatCard
        title="Current streak"
        value={`${currentStreak} day${currentStreak === 1 ? "" : "s"}`}
        hint="Consecutive study days"
        icon={Flame}
        accent="green"
      />
      <StatCard
        title="Longest streak"
        value={`${longestStreak} day${longestStreak === 1 ? "" : "s"}`}
        hint="Your personal best"
        icon={TrendingUp}
        accent="yellow"
      />
    </div>
  );
}

// --------------------------------------------------------------------------- #
// Section shell
// --------------------------------------------------------------------------- #

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-slate-200/80 bg-gradient-to-r from-white/45 to-transparent px-5 py-4 backdrop-blur-md dark:border-white/10 dark:from-slate-900/40 dark:to-transparent">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/15">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

// --------------------------------------------------------------------------- #
// Focus analytics — trend (with granularity toggle) + distribution
// --------------------------------------------------------------------------- #

const GRANULARITIES: Granularity[] = ["daily", "weekly", "monthly"];

export function FocusAnalytics({
  sessions,
  granularity,
  onGranularityChange,
}: {
  sessions: StudySession[];
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
}) {
  const trendData = buildFocusTrend(sessions, granularity);
  const distribution = buildFocusDistribution(sessions);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <SectionCard
          title="Focus trend"
          subtitle="Average focus score over time"
          icon={TrendingUp}
        >
          <div className="mb-4 flex flex-wrap gap-1.5">
            {GRANULARITIES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onGranularityChange(g)}
                aria-pressed={g === granularity}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  g === granularity
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-white/50 hover:text-text dark:hover:bg-white/[0.08]",
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <FocusTrendChart data={trendData} />
        </SectionCard>
      </div>
      <SectionCard
        title="Focus distribution"
        subtitle="Sessions by focus band"
        icon={Gauge}
      >
        <FocusDistributionChart data={distribution} />
      </SectionCard>
    </div>
  );
}

// --------------------------------------------------------------------------- #
// Study patterns
// --------------------------------------------------------------------------- #

function PatternTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/55 bg-white/[0.28] p-4 backdrop-blur-xl dark:border-white/[0.14] dark:bg-slate-900/[0.34]">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-text">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function StudyPatterns({ analytics }: { analytics: AnalyticsBundle }) {
  const { patterns } = analytics;
  return (
    <SectionCard
      title="Study patterns"
      subtitle="When you tend to do your best work"
      icon={CalendarCheck}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PatternTile
          label="Best study time"
          value={
            patterns.bestWindow
              ? formatHourRange(patterns.bestWindow.start, patterns.bestWindow.end)
              : "—"
          }
          hint={
            patterns.bestWindow
              ? `${patterns.bestWindow.avgFocus}% avg focus`
              : "Not enough data"
          }
        />
        <PatternTile
          label="Best study day"
          value={patterns.bestDay ? weekdayLong(patterns.bestDay.dow) : "—"}
          hint={
            patterns.bestDay
              ? `${patterns.bestDay.avgFocus}% avg focus`
              : "Not enough data"
          }
        />
        <PatternTile
          label="Most productive window"
          value={
            patterns.productiveWindow
              ? formatHourRange(
                  patterns.productiveWindow.start,
                  patterns.productiveWindow.end,
                )
              : "—"
          }
          hint={
            patterns.productiveWindow
              ? `${patterns.productiveWindow.minutes} min logged`
              : "Not enough data"
          }
        />
        <PatternTile
          label="Avg session start"
          value={
            patterns.avgStartMinutes !== null
              ? formatMinutesOfDay(patterns.avgStartMinutes)
              : "—"
          }
        />
      </div>
    </SectionCard>
  );
}

// --------------------------------------------------------------------------- #
// Distraction analytics
// --------------------------------------------------------------------------- #

export function DistractionAnalyticsSection({
  analytics,
}: {
  analytics: AnalyticsBundle;
}) {
  const { distractions } = analytics;
  const byHour = distractions.byHour.map((count, h) => ({
    name: HOUR_LABELS[h],
    count,
  }));
  const byDay = distractions.byDay.map((count, d) => ({
    name: weekdayShort(d),
    count,
  }));

  return (
    <SectionCard
      title="Distraction analytics"
      subtitle="What's pulling your attention away"
      icon={Smartphone}
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          icon={Activity}
          label="Total distractions"
          value={String(distractions.totalDistractions)}
        />
        <MiniStat
          icon={Smartphone}
          label="Phone events"
          value={String(distractions.phoneEvents)}
        />
        <MiniStat
          icon={PhoneOff}
          label="Drowsiness events"
          value={String(distractions.drowsinessEvents)}
        />
        <MiniStat
          icon={Clock}
          label="Peak distraction"
          value={
            distractions.mostCommonHour !== null
              ? formatHourRange(
                  distractions.mostCommonHour,
                  distractions.mostCommonHour + 1,
                )
              : "—"
          }
        />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Distractions by hour
          </p>
          <DistractionBarChart data={byHour} />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Distractions by day
          </p>
          <DistractionBarChart data={byDay} />
        </div>
      </div>
    </SectionCard>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/55 bg-white/[0.28] p-3.5 backdrop-blur-xl dark:border-white/[0.14] dark:bg-slate-900/[0.34]">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-text">
        {value}
      </p>
    </div>
  );
}

// --------------------------------------------------------------------------- #
// Consistency
// --------------------------------------------------------------------------- #

export function ConsistencySection({
  analytics,
  currentStreak,
  longestStreak,
}: {
  analytics: AnalyticsBundle;
  currentStreak: number;
  longestStreak: number;
}) {
  const { consistency, comparison } = analytics;
  const consistencyDelta = comparison?.consistencyScore ?? null;

  return (
    <SectionCard
      title="Study consistency"
      subtitle="How regularly you show up"
      icon={Repeat}
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text">
                Consistency score
              </span>
              <span className="text-sm font-semibold tabular-nums text-text">
                {consistency.consistencyScore}%
              </span>
            </div>
            <Progress value={consistency.consistencyScore} className="mt-2" />
            <p className="mt-2 text-xs text-muted">
              You studied on {consistency.daysStudied} of the last{" "}
              {consistency.totalDays} days
              {consistencyDelta !== null && Math.abs(Math.round(consistencyDelta)) >= 1
                ? ` · ${consistencyDelta > 0 ? "+" : ""}${Math.round(consistencyDelta)}% vs previous`
                : ""}
              .
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat
            icon={Flame}
            label="Current streak"
            value={`${currentStreak}d`}
          />
          <MiniStat
            icon={TrendingUp}
            label="Longest streak"
            value={`${longestStreak}d`}
          />
          <MiniStat
            icon={Activity}
            label="Sessions / week"
            value={consistency.sessionsPerWeek.toFixed(1)}
          />
          <MiniStat
            icon={CalendarCheck}
            label="Study frequency"
            value={`${consistency.studyFrequencyPct}%`}
          />
        </div>
      </div>
    </SectionCard>
  );
}

// --------------------------------------------------------------------------- #
// Personalized insights
// --------------------------------------------------------------------------- #

const INSIGHT_STYLES: Record<
  Insight["tone"],
  { dot: string; badge: "green" | "yellow" | "muted" }
> = {
  positive: { dot: "bg-success", badge: "green" },
  warning: { dot: "bg-alert", badge: "yellow" },
  neutral: { dot: "bg-primary", badge: "muted" },
};

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  return (
    <SectionCard
      title="Personalized insights"
      subtitle="Generated from your study data"
      icon={Lightbulb}
    >
      {insights.length === 0 ? (
        <p className="text-sm text-muted">
          Complete a few more sessions and we&apos;ll surface tailored insights
          here.
        </p>
      ) : (
        <ul className="space-y-3">
          {insights.map((ins) => (
            <li key={ins.id} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  INSIGHT_STYLES[ins.tone].dot,
                )}
                aria-hidden
              />
              <p className="text-sm leading-relaxed text-text">{ins.text}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// --------------------------------------------------------------------------- #
// Progress comparison (day / week / month)
// --------------------------------------------------------------------------- #

export type ComparisonMode = "day" | "week" | "month";

export function ProgressComparison({
  mode,
  onModeChange,
  rows,
}: {
  mode: ComparisonMode;
  onModeChange: (m: ComparisonMode) => void;
  rows: { label: string; current: string; deltaPct: number | null; goodDirection?: "up" | "down" }[];
}) {
  const modes: { value: ComparisonMode; label: string }[] = [
    { value: "day", label: "Today vs Yesterday" },
    { value: "week", label: "This vs Last Week" },
    { value: "month", label: "This vs Last Month" },
  ];

  return (
    <SectionCard
      title="Progress comparison"
      subtitle="How this period stacks up against the last"
      icon={Sparkles}
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onModeChange(m.value)}
            aria-pressed={m.value === mode}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              m.value === mode
                ? "bg-primary text-white"
                : "text-muted hover:bg-white/50 hover:text-text dark:hover:bg-white/[0.08]",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-slate-200/70 dark:divide-white/10">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between gap-3 py-3"
          >
            <span className="text-sm text-text">{r.label}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tabular-nums text-text">
                {r.current}
              </span>
              <DeltaBadge value={r.deltaPct} goodDirection={r.goodDirection} />
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function DeltaBadge({
  value,
  goodDirection = "up",
}: {
  value: number | null;
  goodDirection?: "up" | "down";
}) {
  if (value === null) {
    return <Badge tone="muted">—</Badge>;
  }
  const rounded = Math.round(value);
  if (rounded === 0) return <Badge tone="muted">0%</Badge>;
  const isUp = rounded > 0;
  const good = goodDirection === "up" ? isUp : !isUp;
  return (
    <Badge tone={good ? "green" : "red"}>
      {isUp ? "+" : ""}
      {rounded}%
    </Badge>
  );
}
