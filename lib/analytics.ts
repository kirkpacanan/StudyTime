/**
 * StudyTime — Study Analytics engine.
 *
 * Pure, side-effect-free functions that turn a user's raw `StudySession[]` into
 * everything the analytics dashboard renders: range filtering, performance
 * overview with previous-period comparison, focus trends, focus distribution,
 * study-pattern analysis, distraction analytics, consistency scoring, and
 * dynamically-generated insights.
 *
 * Mirrors the existing `lib/reports.ts` pattern (plain functions over sessions)
 * so the page layer stays a thin consumer. Nothing here touches storage, React,
 * or the DOM, which keeps it trivially testable and reusable.
 */

import type { SessionEvent, StudySession } from "./types";

// --------------------------------------------------------------------------- #
// Shared focus banding — identical thresholds to the ML pipeline
// (High 80–100, Medium 60–79, Low 0–59).
// --------------------------------------------------------------------------- #

export type FocusBand = "High" | "Medium" | "Low";

export function focusBand(score: number): FocusBand {
  if (score >= 80) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

export const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Distraction-type session events (the ones with real per-event timestamps). */
const DISTRACTION_EVENT_TYPES: SessionEvent["type"][] = [
  "phone_detected",
  "look_away_long",
  "head_down_long",
  "eyes_closed_10s",
];

// --------------------------------------------------------------------------- #
// Date helpers
// --------------------------------------------------------------------------- #

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}

/** Monday-based weekday index (0 = Mon … 6 = Sun) to match the ML convention. */
function mondayDow(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// --------------------------------------------------------------------------- #
// Time ranges
// --------------------------------------------------------------------------- #

export type RangePreset = "today" | "7d" | "30d" | "3m" | "all" | "custom";

export type DateRange = {
  start: Date;
  end: Date;
  preset: RangePreset;
};

export const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "3m", label: "Last 3 Months" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom" },
];

/** Resolve a preset (and optional custom dates) into a concrete [start, end]. */
export function resolveRange(
  preset: RangePreset,
  sessions: StudySession[],
  custom?: { start: Date; end: Date },
): DateRange {
  const now = new Date();
  const todayStart = startOfDay(now);

  switch (preset) {
    case "today":
      return { start: todayStart, end: now, preset };
    case "7d":
      return { start: addDays(todayStart, -6), end: now, preset };
    case "30d":
      return { start: addDays(todayStart, -29), end: now, preset };
    case "3m":
      return { start: addDays(todayStart, -89), end: now, preset };
    case "custom": {
      const start = custom ? startOfDay(custom.start) : addDays(todayStart, -29);
      const end = custom ? endOfDay(custom.end) : now;
      return { start, end, preset };
    }
    case "all":
    default: {
      const earliest = sessions.reduce<number>((min, s) => {
        const t = new Date(s.startedAt).getTime();
        return t < min ? t : min;
      }, now.getTime());
      return { start: new Date(earliest), end: now, preset };
    }
  }
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** The equal-length window immediately preceding `range` (null for all-time). */
export function previousRange(range: DateRange): DateRange | null {
  if (range.preset === "all") return null;
  const span = range.end.getTime() - range.start.getTime();
  const prevEnd = new Date(range.start.getTime() - 1);
  const prevStart = new Date(range.start.getTime() - span);
  return { start: prevStart, end: prevEnd, preset: range.preset };
}

export function sessionsInRange(
  sessions: StudySession[],
  range: DateRange,
): StudySession[] {
  const lo = range.start.getTime();
  const hi = range.end.getTime();
  return sessions.filter((s) => {
    const t = new Date(s.startedAt).getTime();
    return t >= lo && t <= hi;
  });
}

/** Inclusive number of calendar days the range spans (min 1). */
export function rangeDays(range: DateRange): number {
  const ms = endOfDay(range.end).getTime() - startOfDay(range.start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

// --------------------------------------------------------------------------- #
// Performance overview + comparison
// --------------------------------------------------------------------------- #

export type Overview = {
  studyHours: number;
  avgFocus: number;
  sessionCount: number;
  avgDurationMin: number;
  totalDistractions: number;
  daysStudied: number;
  consistencyScore: number;
};

export function computeOverview(
  sessions: StudySession[],
  days: number,
): Overview {
  const sessionCount = sessions.length;
  const focusMsTotal = sessions.reduce((a, s) => a + s.focusMs, 0);
  const avgFocus = sessionCount
    ? sessions.reduce((a, s) => a + s.averageFocus, 0) / sessionCount
    : 0;
  const daysStudied = new Set(
    sessions.map((s) => dayKey(new Date(s.startedAt))),
  ).size;

  return {
    studyHours: focusMsTotal / 3_600_000,
    avgFocus,
    sessionCount,
    avgDurationMin: sessionCount ? focusMsTotal / 60_000 / sessionCount : 0,
    totalDistractions: sessions.reduce((a, s) => a + s.distractionEvents, 0),
    daysStudied,
    consistencyScore: Math.round((daysStudied / days) * 100),
  };
}

/** Signed percentage change; null when there's no comparable baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export type MetricKey = keyof Overview;

export type Comparison = Record<MetricKey, number | null>;

export function compareOverviews(
  current: Overview,
  previous: Overview,
): Comparison {
  const keys = Object.keys(current) as MetricKey[];
  const out = {} as Comparison;
  for (const k of keys) out[k] = pctChange(current[k], previous[k]);
  return out;
}

// --------------------------------------------------------------------------- #
// Focus trend (daily / weekly / monthly)
// --------------------------------------------------------------------------- #

export type Granularity = "daily" | "weekly" | "monthly";

export type TrendPoint = {
  key: string;
  label: string;
  avgFocus: number | null;
  studyMinutes: number;
  sessions: number;
};

/** Pick a sensible default granularity for a range length. */
export function defaultGranularity(days: number): Granularity {
  if (days <= 31) return "daily";
  if (days <= 92) return "weekly";
  return "monthly";
}

function bucketOf(date: Date, g: Granularity): { key: string; label: string } {
  if (g === "monthly") {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: date.toLocaleDateString(undefined, {
        month: "short",
        year: "2-digit",
      }),
    };
  }
  if (g === "weekly") {
    const monday = addDays(startOfDay(date), -mondayDow(date));
    return {
      key: dayKey(monday),
      label: monday.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    };
  }
  const d = startOfDay(date);
  return {
    key: dayKey(d),
    label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  };
}

export function buildFocusTrend(
  sessions: StudySession[],
  g: Granularity,
): TrendPoint[] {
  const buckets = new Map<
    string,
    { label: string; focusSum: number; minutes: number; sessions: number }
  >();

  for (const s of sessions) {
    const { key, label } = bucketOf(new Date(s.startedAt), g);
    const b = buckets.get(key) ?? {
      label,
      focusSum: 0,
      minutes: 0,
      sessions: 0,
    };
    b.focusSum += s.averageFocus;
    b.minutes += s.focusMs / 60_000;
    b.sessions += 1;
    buckets.set(key, b);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, b]) => ({
      key,
      label: b.label,
      avgFocus: b.sessions ? Math.round(b.focusSum / b.sessions) : null,
      studyMinutes: Math.round(b.minutes),
      sessions: b.sessions,
    }));
}

// --------------------------------------------------------------------------- #
// Focus distribution
// --------------------------------------------------------------------------- #

export type DistributionSlice = {
  band: FocusBand;
  count: number;
  pct: number;
};

export function buildFocusDistribution(
  sessions: StudySession[],
): DistributionSlice[] {
  const counts: Record<FocusBand, number> = { High: 0, Medium: 0, Low: 0 };
  for (const s of sessions) counts[focusBand(s.averageFocus)] += 1;
  const total = sessions.length || 1;
  return (["High", "Medium", "Low"] as FocusBand[]).map((band) => ({
    band,
    count: counts[band],
    pct: Math.round((counts[band] / total) * 100),
  }));
}

// --------------------------------------------------------------------------- #
// Study pattern analysis
// --------------------------------------------------------------------------- #

export type Patterns = {
  /** Highest average-focus 2-hour window, e.g. {start:19,end:21}. */
  bestWindow: { start: number; end: number; avgFocus: number } | null;
  /** 2-hour window with the most total focus minutes. */
  productiveWindow: { start: number; end: number; minutes: number } | null;
  bestDay: { dow: number; avgFocus: number } | null;
  /** Mean session start time in minutes-since-midnight, or null. */
  avgStartMinutes: number | null;
  /** Per-hour average focus for charts (length 24, null when no sessions). */
  hourlyFocus: (number | null)[];
};

export function analyzePatterns(sessions: StudySession[]): Patterns {
  const hourCount = new Array(24).fill(0);
  const hourFocus = new Array(24).fill(0);
  const hourMinutes = new Array(24).fill(0);
  const dayCount = new Array(7).fill(0);
  const dayFocus = new Array(7).fill(0);
  let startMinutesSum = 0;

  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const h = d.getHours();
    hourCount[h] += 1;
    hourFocus[h] += s.averageFocus;
    hourMinutes[h] += s.focusMs / 60_000;
    const dow = mondayDow(d);
    dayCount[dow] += 1;
    dayFocus[dow] += s.averageFocus;
    startMinutesSum += d.getHours() * 60 + d.getMinutes();
  }

  let bestWindow: Patterns["bestWindow"] = null;
  let productiveWindow: Patterns["productiveWindow"] = null;
  for (let h = 0; h <= 22; h++) {
    const c = hourCount[h] + hourCount[h + 1];
    if (c > 0) {
      const avg = (hourFocus[h] + hourFocus[h + 1]) / c;
      if (!bestWindow || avg > bestWindow.avgFocus) {
        bestWindow = { start: h, end: h + 2, avgFocus: Math.round(avg) };
      }
    }
    const mins = hourMinutes[h] + hourMinutes[h + 1];
    if (mins > 0 && (!productiveWindow || mins > productiveWindow.minutes)) {
      productiveWindow = { start: h, end: h + 2, minutes: Math.round(mins) };
    }
  }

  let bestDay: Patterns["bestDay"] = null;
  for (let dow = 0; dow < 7; dow++) {
    if (dayCount[dow] > 0) {
      const avg = dayFocus[dow] / dayCount[dow];
      if (!bestDay || avg > bestDay.avgFocus) {
        bestDay = { dow, avgFocus: Math.round(avg) };
      }
    }
  }

  return {
    bestWindow,
    productiveWindow,
    bestDay,
    avgStartMinutes: sessions.length
      ? Math.round(startMinutesSum / sessions.length)
      : null,
    hourlyFocus: hourCount.map((c, h) =>
      c > 0 ? Math.round(hourFocus[h] / c) : null,
    ),
  };
}

// --------------------------------------------------------------------------- #
// Distraction analytics
// --------------------------------------------------------------------------- #

export type DistractionAnalytics = {
  /** Existing state-transition distraction count (headline metric). */
  totalDistractions: number;
  /** Timestamped distraction-type events (used by the time charts). */
  totalSignals: number;
  phoneEvents: number;
  drowsinessEvents: number;
  byHour: number[]; // length 24
  byDay: number[]; // length 7 (Mon..Sun)
  mostCommonHour: number | null;
  phonePct: number;
};

export function analyzeDistractions(
  sessions: StudySession[],
): DistractionAnalytics {
  const byHour = new Array(24).fill(0);
  const byDay = new Array(7).fill(0);
  let phoneEvents = 0;
  let drowsinessEvents = 0;
  let totalSignals = 0;

  for (const s of sessions) {
    const base = new Date(s.startedAt).getTime();
    for (const e of s.events ?? []) {
      if (!DISTRACTION_EVENT_TYPES.includes(e.type)) continue;
      const at = new Date(base + e.t);
      byHour[at.getHours()] += 1;
      byDay[mondayDow(at)] += 1;
      totalSignals += 1;
      if (e.type === "phone_detected") phoneEvents += 1;
      if (e.type === "eyes_closed_10s" || e.type === "head_down_long") {
        drowsinessEvents += 1;
      }
    }
  }

  let mostCommonHour: number | null = null;
  let max = 0;
  for (let h = 0; h < 24; h++) {
    if (byHour[h] > max) {
      max = byHour[h];
      mostCommonHour = h;
    }
  }

  return {
    totalDistractions: sessions.reduce((a, s) => a + s.distractionEvents, 0),
    totalSignals,
    phoneEvents,
    drowsinessEvents,
    byHour,
    byDay,
    mostCommonHour,
    phonePct: totalSignals ? Math.round((phoneEvents / totalSignals) * 100) : 0,
  };
}

// --------------------------------------------------------------------------- #
// Consistency
// --------------------------------------------------------------------------- #

export type Consistency = {
  daysStudied: number;
  totalDays: number;
  sessionsPerWeek: number;
  studyFrequencyPct: number;
  consistencyScore: number;
};

export function computeConsistency(
  sessions: StudySession[],
  days: number,
): Consistency {
  const daysStudied = new Set(
    sessions.map((s) => dayKey(new Date(s.startedAt))),
  ).size;
  return {
    daysStudied,
    totalDays: days,
    sessionsPerWeek: (sessions.length / days) * 7,
    studyFrequencyPct: Math.round((daysStudied / days) * 100),
    consistencyScore: Math.round((daysStudied / days) * 100),
  };
}

/**
 * Average focus of long (>45 min) vs short sessions — used to detect whether
 * focus decays during longer sessions.
 */
export function longVsShortFocus(sessions: StudySession[]): {
  longAvg: number | null;
  shortAvg: number | null;
} {
  const long = sessions.filter((s) => s.focusMs / 60_000 > 45);
  const short = sessions.filter((s) => s.focusMs / 60_000 <= 45);
  const avg = (arr: StudySession[]) =>
    arr.length ? arr.reduce((a, s) => a + s.averageFocus, 0) / arr.length : null;
  return { longAvg: avg(long), shortAvg: avg(short) };
}

// --------------------------------------------------------------------------- #
// Formatting helpers (shared with the UI)
// --------------------------------------------------------------------------- #

export function formatHour(h: number): string {
  const hour = ((h % 24) + 24) % 24;
  const period = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${period}`;
}

export function formatHourRange(start: number, end: number): string {
  return `${formatHour(start)} – ${formatHour(end)}`;
}

export function formatMinutesOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${String(m).padStart(2, "0")} ${period}`;
}

export function weekdayLong(dow: number): string {
  return WEEKDAY_LABELS[dow] ?? "—";
}

export function weekdayShort(dow: number): string {
  return WEEKDAY_SHORT[dow] ?? "—";
}

// --------------------------------------------------------------------------- #
// Dynamic insights
// --------------------------------------------------------------------------- #

export type InsightTone = "positive" | "neutral" | "warning";

export type Insight = {
  id: string;
  tone: InsightTone;
  text: string;
};

export type AnalyticsBundle = {
  days: number;
  overview: Overview;
  comparison: Comparison | null;
  patterns: Patterns;
  distractions: DistractionAnalytics;
  consistency: Consistency;
  longShort: { longAvg: number | null; shortAvg: number | null };
};

/**
 * Build the full analytics bundle for a set of sessions already filtered to the
 * current range, plus the previous-period sessions for comparison.
 */
export function buildAnalytics(
  current: StudySession[],
  previous: StudySession[] | null,
  days: number,
): AnalyticsBundle {
  const overview = computeOverview(current, days);
  const comparison =
    previous !== null
      ? compareOverviews(overview, computeOverview(previous, days))
      : null;
  return {
    days,
    overview,
    comparison,
    patterns: analyzePatterns(current),
    distractions: analyzeDistractions(current),
    consistency: computeConsistency(current, days),
    longShort: longVsShortFocus(current),
  };
}

function fmtPct(v: number): string {
  const rounded = Math.round(Math.abs(v));
  return `${rounded}%`;
}

/**
 * Generate insights dynamically from the analytics bundle. Every line is derived
 * from real numbers — nothing is hard-coded — and only insights with enough
 * supporting data are emitted. Returns at most `limit` of the strongest signals.
 */
export function generateInsights(
  a: AnalyticsBundle,
  limit = 6,
): Insight[] {
  const out: Insight[] = [];
  const { overview, comparison, patterns, distractions, consistency, longShort } =
    a;

  if (overview.sessionCount === 0) return out;

  // Focus trend vs previous period.
  if (comparison && comparison.avgFocus !== null) {
    const d = comparison.avgFocus;
    if (d >= 5) {
      out.push({
        id: "focus-up",
        tone: "positive",
        text: `Your average focus improved by ${fmtPct(d)} compared to the previous period.`,
      });
    } else if (d <= -5) {
      out.push({
        id: "focus-down",
        tone: "warning",
        text: `Your average focus dropped by ${fmtPct(d)} versus the previous period — worth a closer look.`,
      });
    } else {
      out.push({
        id: "focus-steady",
        tone: "neutral",
        text: `Your focus stayed consistent (within ${fmtPct(d)}) over this period.`,
      });
    }
  }

  // Best time-of-day window.
  if (patterns.bestWindow && overview.sessionCount >= 3) {
    out.push({
      id: "best-window",
      tone: "positive",
      text: `You focus best around ${formatHourRange(patterns.bestWindow.start, patterns.bestWindow.end)}, averaging ${patterns.bestWindow.avgFocus}% focus then.`,
    });
  }

  // Long vs short sessions.
  if (
    longShort.longAvg !== null &&
    longShort.shortAvg !== null &&
    longShort.shortAvg - longShort.longAvg >= 5
  ) {
    out.push({
      id: "long-decline",
      tone: "warning",
      text: `Focus tends to decline during longer sessions (${Math.round(longShort.longAvg)}% vs ${Math.round(longShort.shortAvg)}% on shorter ones) — try breaking long blocks up.`,
    });
  }

  // Phone share of distractions.
  if (distractions.totalSignals >= 5 && distractions.phonePct >= 30) {
    out.push({
      id: "phone-share",
      tone: "warning",
      text: `Phone interruptions account for ${distractions.phonePct}% of your distractions — your biggest single source.`,
    });
  }

  // Most common distraction hour.
  if (distractions.totalSignals >= 5 && distractions.mostCommonHour !== null) {
    out.push({
      id: "distraction-hour",
      tone: "neutral",
      text: `Most distractions happen around ${formatHourRange(distractions.mostCommonHour, distractions.mostCommonHour + 1)}.`,
    });
  }

  // Session duration change.
  if (comparison && comparison.avgDurationMin !== null) {
    const d = comparison.avgDurationMin;
    if (Math.abs(d) >= 10) {
      out.push({
        id: "duration-change",
        tone: d > 0 ? "positive" : "neutral",
        text: `Your average session length ${d > 0 ? "increased" : "decreased"} by ${fmtPct(d)} compared to the previous period.`,
      });
    }
  }

  // Consistency.
  if (consistency.totalDays >= 7) {
    out.push({
      id: "consistency",
      tone:
        consistency.studyFrequencyPct >= 70
          ? "positive"
          : consistency.studyFrequencyPct >= 40
            ? "neutral"
            : "warning",
      text: `You studied on ${consistency.daysStudied} of the last ${consistency.totalDays} days (${consistency.studyFrequencyPct}% of days).`,
    });
  }

  if (comparison && comparison.consistencyScore !== null) {
    const d = comparison.consistencyScore;
    if (d >= 10) {
      out.push({
        id: "consistency-up",
        tone: "positive",
        text: `Your consistency improved by ${fmtPct(d)} compared to the previous period.`,
      });
    }
  }

  // Best weekday.
  if (patterns.bestDay && overview.sessionCount >= 4) {
    out.push({
      id: "best-day",
      tone: "neutral",
      text: `${weekdayLong(patterns.bestDay.dow)} is your strongest day, averaging ${patterns.bestDay.avgFocus}% focus.`,
    });
  }

  return out.slice(0, limit);
}
