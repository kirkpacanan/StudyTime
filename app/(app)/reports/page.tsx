"use client";

import { FocusPredictionCard } from "@/components/FocusPredictionCard";
import {
  ConsistencySection,
  DistractionAnalyticsSection,
  FocusAnalytics,
  InsightsPanel,
  PerformanceOverview,
  ProgressComparison,
  StudyPatterns,
  type ComparisonMode,
} from "@/components/analytics/AnalyticsSections";
import {
  TimeRangeFilter,
  type CustomRange,
} from "@/components/analytics/TimeRangeFilter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  buildAnalytics,
  computeOverview,
  defaultGranularity,
  formatHourRange,
  generateInsights,
  pctChange,
  previousRange,
  rangeDays,
  resolveRange,
  sessionsInRange,
  type DateRange,
  type Granularity,
  type RangePreset,
} from "@/lib/analytics";
import { getStreakState } from "@/lib/gamification/progression-storage";
import { getSessionsForUser } from "@/lib/storage";
import type { StudySession } from "@/lib/types";
import { BarChart3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// --------------------------------------------------------------------------- #
// Progress comparison windows (independent of the main range filter)
// --------------------------------------------------------------------------- #

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function comparisonWindows(mode: ComparisonMode): {
  current: { start: Date; end: Date };
  previous: { start: Date; end: Date };
} {
  const now = new Date();
  if (mode === "day") {
    const todayStart = startOfDay(now);
    const yStart = new Date(todayStart);
    yStart.setDate(yStart.getDate() - 1);
    return {
      current: { start: todayStart, end: now },
      previous: { start: yStart, end: new Date(todayStart.getTime() - 1) },
    };
  }
  if (mode === "week") {
    const dow = (now.getDay() + 6) % 7; // Monday-based
    const weekStart = startOfDay(now);
    weekStart.setDate(weekStart.getDate() - dow);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    return {
      current: { start: weekStart, end: now },
      previous: { start: lastWeekStart, end: new Date(weekStart.getTime() - 1) },
    };
  }
  // month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    current: { start: monthStart, end: now },
    previous: { start: lastMonthStart, end: new Date(monthStart.getTime() - 1) },
  };
}

function inWindow(
  sessions: StudySession[],
  w: { start: Date; end: Date },
): StudySession[] {
  const lo = w.start.getTime();
  const hi = w.end.getTime();
  return sessions.filter((s) => {
    const t = new Date(s.startedAt).getTime();
    return t >= lo && t <= hi;
  });
}

function buildComparisonRows(
  sessions: StudySession[],
  mode: ComparisonMode,
) {
  const { current, previous } = comparisonWindows(mode);
  const days = Math.max(
    1,
    Math.round((current.end.getTime() - current.start.getTime()) / 86_400_000),
  );
  const cur = computeOverview(inWindow(sessions, current), days);
  const prev = computeOverview(inWindow(sessions, previous), days);

  return [
    {
      label: "Study hours",
      current: `${cur.studyHours.toFixed(1)} h`,
      deltaPct: pctChange(cur.studyHours, prev.studyHours),
      goodDirection: "up" as const,
    },
    {
      label: "Focus score",
      current: `${Math.round(cur.avgFocus)}%`,
      deltaPct: pctChange(cur.avgFocus, prev.avgFocus),
      goodDirection: "up" as const,
    },
    {
      label: "Sessions",
      current: String(cur.sessionCount),
      deltaPct: pctChange(cur.sessionCount, prev.sessionCount),
      goodDirection: "up" as const,
    },
    {
      label: "Distractions",
      current: String(cur.totalDistractions),
      deltaPct: pctChange(cur.totalDistractions, prev.totalDistractions),
      goodDirection: "down" as const,
    },
    {
      label: "Consistency",
      current: `${cur.consistencyScore}%`,
      deltaPct: pctChange(cur.consistencyScore, prev.consistencyScore),
      goodDirection: "up" as const,
    },
  ];
}

// --------------------------------------------------------------------------- #
// Page
// --------------------------------------------------------------------------- #

export default function ReportsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<StudySession[] | null>(null);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });

  const [preset, setPreset] = useState<RangePreset>("30d");
  const [custom, setCustom] = useState<CustomRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  });
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("week");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void Promise.all([
      getSessionsForUser(user.id),
      getStreakState(user.id),
    ]).then(([s, st]) => {
      if (cancelled) return;
      setSessions(s);
      setStreak({ current: st.current, longest: st.longest });
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const range: DateRange | null = useMemo(() => {
    if (!sessions) return null;
    const customDates =
      preset === "custom"
        ? {
            start: new Date(custom.start + "T00:00:00"),
            end: new Date(custom.end + "T00:00:00"),
          }
        : undefined;
    return resolveRange(preset, sessions, customDates);
  }, [sessions, preset, custom]);

  const analytics = useMemo(() => {
    if (!sessions || !range) return null;
    const current = sessionsInRange(sessions, range);
    const prev = previousRange(range);
    const prevSessions = prev ? sessionsInRange(sessions, prev) : null;
    return buildAnalytics(current, prevSessions, rangeDays(range));
  }, [sessions, range]);

  const rangeSessions = useMemo(() => {
    if (!sessions || !range) return [];
    return sessionsInRange(sessions, range);
  }, [sessions, range]);

  const insights = useMemo(
    () => (analytics ? generateInsights(analytics) : []),
    [analytics],
  );

  const comparisonRows = useMemo(
    () => (sessions ? buildComparisonRows(sessions, comparisonMode) : []),
    [sessions, comparisonMode],
  );

  const recommendedTime = analytics?.patterns.bestWindow
    ? formatHourRange(
        analytics.patterns.bestWindow.start,
        analytics.patterns.bestWindow.end,
      )
    : undefined;

  function handlePresetChange(p: RangePreset) {
    setPreset(p);
    if (sessions) {
      const r = resolveRange(p, sessions);
      setGranularity(defaultGranularity(rangeDays(r)));
    }
  }

  function downloadReport() {
    if (!analytics || !user || !range) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      userId: user.id,
      range: {
        preset: range.preset,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },
      streak,
      analytics,
      insights,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studytime-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Loading state ---
  if (!user || !sessions || !analytics) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-white/40 dark:bg-white/[0.06]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl bg-white/40 dark:bg-white/[0.06]"
            />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-white/40 dark:bg-white/[0.06]" />
      </div>
    );
  }

  // --- Empty state (no sessions at all) ---
  if (sessions.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            Study Analytics
          </h1>
          <p className="mt-1 text-sm text-muted">
            Insights, trends, and predictions from your study sessions.
          </p>
        </div>
        <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/15">
            <BarChart3 className="h-7 w-7" aria-hidden />
          </div>
          <div>
            <p className="text-base font-medium text-text">No study data yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Run a few focus sessions and your analytics dashboard will fill in
              with trends, patterns, and AI predictions.
            </p>
          </div>
          <Button type="button" onClick={() => (window.location.href = "/session")}>
            Start a study session
          </Button>
        </Card>
      </div>
    );
  }

  const noRangeData = rangeSessions.length === 0;

  return (
    <div className="space-y-8">
      {/* Header + range filter */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            Study Analytics
          </h1>
          <p className="mt-1 text-sm text-muted">
            Insights, trends, and predictions from your study sessions.
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <TimeRangeFilter
            preset={preset}
            custom={custom}
            onPresetChange={handlePresetChange}
            onCustomChange={setCustom}
          />
          <Button type="button" variant="secondary" onClick={downloadReport}>
            Download report (.json)
          </Button>
        </div>
      </div>

      {noRangeData ? (
        <Card className="px-6 py-12 text-center">
          <p className="text-sm text-muted">
            No sessions in this time range. Try a wider range.
          </p>
        </Card>
      ) : (
        <>
          {/* 2 — Performance overview */}
          <PerformanceOverview
            analytics={analytics}
            currentStreak={streak.current}
            longestStreak={streak.longest}
          />

          {/* 9 — AI prediction + 8 — Insights */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <FocusPredictionCard
              sessions={sessions}
              recommendedTime={recommendedTime}
            />
            <InsightsPanel insights={insights} />
          </div>

          {/* 3 — Focus analytics */}
          <FocusAnalytics
            sessions={rangeSessions}
            granularity={granularity}
            onGranularityChange={setGranularity}
          />

          {/* 4 — Study patterns */}
          <StudyPatterns analytics={analytics} />

          {/* 5 — Distraction analytics */}
          <DistractionAnalyticsSection analytics={analytics} />

          {/* 6 — Consistency + 7 — Progress comparison */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ConsistencySection
              analytics={analytics}
              currentStreak={streak.current}
              longestStreak={streak.longest}
            />
            <ProgressComparison
              mode={comparisonMode}
              onModeChange={setComparisonMode}
              rows={comparisonRows}
            />
          </div>
        </>
      )}
    </div>
  );
}
