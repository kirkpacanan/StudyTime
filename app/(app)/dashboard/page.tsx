"use client";

import { StatCard } from "@/components/StatCard";
import { WeeklyFocusChart } from "@/components/WeeklyFocusChart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { buildWeeklyReport } from "@/lib/reports";
import { getSessionsForUser } from "@/lib/storage";
import {
  BarChart3,
  ChevronRight,
  Clock,
  Flame,
  LineChart,
  Settings2,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

function useDashboardMotion(reduce: boolean) {
  return useMemo(() => {
    const ease = [0.16, 1, 0.3, 1] as const;
    return {
      section: {
        hidden: {},
        show: {
          transition: {
            staggerChildren: reduce ? 0 : 0.07,
            delayChildren: reduce ? 0 : 0.03,
          },
        },
      },
      fadeUp: {
        hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 16 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: reduce ? 0 : 0.45, ease },
        },
      },
    };
  }, [reduce]);
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTodayLine() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function WeekFocusRing({ value }: { value: number | null }) {
  const rawId = useId();
  const gradId = `wk-ring-${rawId.replace(/:/g, "")}`;
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.min(100, Math.max(0, value));
  const offset = c * (1 - pct / 100);

  return (
    <div className="flex w-full max-w-[220px] flex-col items-center gap-1 sm:max-w-none">
      <div className="relative aspect-square w-full max-w-[200px] drop-shadow-[0_12px_32px_rgba(79,134,247,0.22)] dark:drop-shadow-[0_12px_36px_rgba(34,211,238,0.18)]">
        <svg
          viewBox="0 0 140 140"
          className="h-full w-full -rotate-90"
          aria-hidden
        >
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="11"
            className="text-primary/20 dark:text-cyan-400/18"
          />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={value == null ? c : offset}
            className="transition-[stroke-dashoffset] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
          />
          <defs>
            <linearGradient
              id={gradId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Week focus
          </span>
          <span className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-text">
            {value == null ? "—" : `${value}%`}
          </span>
        </div>
      </div>
    </div>
  );
}

const quickLinkClass =
  "group inline-flex items-center gap-2 rounded-xl border border-slate-200/95 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-[0_4px_18px_-4px_rgba(15,23,42,0.08)] backdrop-blur-sm transition duration-200 hover:border-primary/40 hover:bg-white hover:shadow-[0_10px_32px_-8px_rgba(79,134,247,0.18)] dark:border-white/10 dark:bg-white/[0.06] dark:text-text dark:shadow-none dark:backdrop-blur-md dark:hover:border-cyan-500/25 dark:hover:bg-white/[0.1] dark:hover:shadow-md";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const reduce = reduceMotion === true;
  const { section, fadeUp } = useDashboardMotion(reduce);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    void tick;
    if (!user) return null;
    const sessions = getSessionsForUser(user.id);
    const report = buildWeeklyReport(sessions);
    const now = new Date();
    const todaySessions = sessions.filter((s) =>
      isSameLocalDay(new Date(s.startedAt), now),
    );
    const todayMinutes = Math.round(
      todaySessions.reduce((a, s) => a + s.focusMs, 0) / 60000,
    );
    const todayAvg =
      todaySessions.length === 0
        ? null
        : Math.round(
            todaySessions.reduce((a, s) => a + s.averageFocus, 0) /
              todaySessions.length,
          );
    const weekSessions = sessions.filter((s) => {
      const d = new Date(s.startedAt);
      const diff = now.getTime() - d.getTime();
      return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000;
    });
    return {
      report,
      todayMinutes,
      todayAvg,
      weekSessionCount: weekSessions.length,
    };
  }, [user, tick]);

  if (!user) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-primary/20" />
        <p className="text-sm text-muted">Loading your dashboard…</p>
      </div>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const report = stats?.report;

  return (
    <motion.div
      className="dashboard-page space-y-8 md:space-y-10"
      variants={section}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      {/* Hero — light: crisp paper + sky wash; dark: existing deep glass */}
      <motion.div
        variants={fadeUp}
        className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-gradient-to-br from-white via-sky-50/90 to-[#eef6ff] p-6 shadow-[0_22px_70px_-28px_rgba(79,134,247,0.22),0_0_0_1px_rgba(255,255,255,0.75)_inset] ring-1 ring-white/80 backdrop-blur-xl dark:border-white/10 dark:from-[#080d16] dark:via-[#0f172a] dark:to-[#060a10] dark:shadow-[0_28px_90px_-36px_rgba(0,0,0,0.65)] dark:ring-0 md:p-10"
      >
        <div
          className="pointer-events-none absolute -left-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-primary/14 blur-3xl dark:bg-cyan-500/15"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-sky-300/35 blur-3xl dark:bg-indigo-500/20"
          aria-hidden
        />
        <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-primary/20 bg-primary/[0.11] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary shadow-sm dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-200 dark:shadow-none">
                Overview
              </span>
              <span className="text-sm text-muted">{formatTodayLine()}</span>
            </div>
            <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.12] tracking-tight text-text">
              {greeting},{" "}
              <span className="bg-gradient-to-r from-primary via-sky-500 to-emerald-500 bg-clip-text text-transparent dark:from-sky-300 dark:via-cyan-300 dark:to-emerald-400">
                {user.name.split(" ")[0]}
              </span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-600 md:text-[17px] md:leading-relaxed dark:text-muted">
              Track today’s depth, your week’s momentum, and where focus drifts —
              built for steady progress, not pressure.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link href="/session" className={quickLinkClass}>
                <Timer className="h-4 w-4 text-primary dark:text-cyan-300" />
                Session
                <ChevronRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
              <Link href="/reports" className={quickLinkClass}>
                <LineChart className="h-4 w-4 text-primary dark:text-cyan-300" />
                Reports
                <ChevronRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
              <Link href="/settings" className={quickLinkClass}>
                <Settings2 className="h-4 w-4 text-muted" />
                Settings
                <ChevronRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <WeekFocusRing value={report?.avgFocusWeek ?? null} />
          </div>
        </div>
      </motion.div>

      {/* Rolling week snapshot */}
      {report ? (
        <motion.div variants={fadeUp}>
          <Card className="grid grid-cols-1 divide-y divide-slate-200/90 overflow-hidden p-0 dark:divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              {
                icon: Clock,
                label: "7-day study",
                value: `${report.totalStudyMinutes} min`,
                hint: "Focused time logged",
              },
              {
                icon: Target,
                label: "Week avg focus",
                value:
                  report.avgFocusWeek != null
                    ? `${report.avgFocusWeek}%`
                    : "—",
                hint: "Days with sessions only",
              },
              {
                icon: BarChart3,
                label: "Sessions completed",
                value: String(report.sessionsCompleted),
                hint: "Finished in the window",
              },
            ].map((cell) => (
              <div
                key={cell.label}
                className="flex items-start gap-4 bg-gradient-to-b from-white/80 to-slate-50/40 px-5 py-5 dark:from-transparent dark:to-transparent md:px-6 md:py-6"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-white text-primary shadow-sm dark:border-transparent dark:bg-cyan-500/10 dark:text-cyan-300 dark:shadow-none">
                  <cell.icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted">{cell.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-text">
                    {cell.value}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{cell.hint}</p>
                </div>
              </div>
            ))}
          </Card>
        </motion.div>
      ) : null}

      {/* KPI row — equal-width columns at xl so copy never pinches */}
      <motion.div
        variants={section}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4 xl:items-stretch"
      >
        <motion.div
          variants={fadeUp}
          className="flex h-full min-h-0 min-w-0 w-full"
        >
          <StatCard
            title="Today · study time"
            value={stats ? `${stats.todayMinutes} min` : "—"}
            hint="Focused blocks logged today"
            icon={Clock}
            accent="blue"
          />
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="flex h-full min-h-0 min-w-0 w-full"
        >
          <StatCard
            title="Today · avg focus"
            value={
              stats?.todayAvg !== null && stats?.todayAvg !== undefined
                ? `${stats.todayAvg}%`
                : "—"
            }
            hint="From your latest sessions"
            icon={Target}
            accent="green"
          />
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="flex h-full min-h-0 min-w-0 w-full"
        >
          <StatCard
            title="This week · sessions"
            value={stats ? String(stats.weekSessionCount) : "—"}
            hint="Last rolling 7 days"
            icon={BarChart3}
            accent="yellow"
          />
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="flex h-full min-h-0 min-w-0 w-full"
        >
          <StatCard
            title="Streak"
            value={stats ? `${stats.report.streak} day(s)` : "—"}
            hint="Consecutive days with a session"
            icon={Flame}
            accent="green"
          />
        </motion.div>
      </motion.div>

      {/* CTA — dark: opaque slate fill so theme tokens (light text) never sit on a white card */}
      <motion.div variants={fadeUp}>
        <div className="relative overflow-hidden rounded-[1.65rem] border border-slate-200/90 bg-gradient-to-br from-white via-sky-50/70 to-blue-50/50 p-px shadow-[0_16px_48px_-20px_rgba(79,134,247,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-gradient-to-br dark:from-slate-600 dark:via-slate-700 dark:to-slate-800 dark:shadow-soft-dark">
          <div className="relative overflow-hidden rounded-[1.54rem] bg-gradient-to-br from-white via-white to-sky-50/60 px-6 py-7 md:px-9 md:py-8 dark:from-[#0b101c] dark:via-[#111827] dark:to-[#070b12]">
            <div
              className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full bg-primary/16 blur-3xl dark:bg-cyan-500/18"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-24 -left-8 h-48 w-48 rounded-full bg-emerald-400/22 blur-3xl dark:bg-emerald-500/12"
              aria-hidden
            />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
              <div className="flex min-w-0 flex-1 gap-5">
                <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-white text-primary shadow-[0_8px_24px_-12px_rgba(79,134,247,0.25)] dark:border-slate-600/90 dark:bg-slate-800 dark:text-cyan-300 dark:shadow-[inset_0_1px_0_rgba(15,23,42,0.45)] sm:flex">
                  <Sparkles className="h-7 w-7" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight text-text md:text-2xl md:leading-snug">
                    Ready for a focused block?
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-muted md:text-[15px]">
                    Start a Pomodoro session to log focus and keep your weekly
                    picture accurate — short runs still count.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  className="px-8 shadow-[0_10px_32px_-10px_rgba(79,134,247,0.5)] dark:shadow-[0_12px_36px_-10px_rgba(34,211,238,0.28)]"
                  onClick={() => router.push("/session")}
                >
                  Start study session
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-6"
                  onClick={() => router.push("/reports")}
                >
                  View reports
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Chart — nested glass well so the plot reads above the backdrop */}
      <motion.div variants={fadeUp}>
        <Card className="chart-week-at-glance overflow-hidden p-0">
          <div className="relative border-b border-white/55 bg-gradient-to-r from-white/45 via-sky-50/25 to-blue-50/20 px-5 py-5 backdrop-blur-2xl dark:border-white/10 dark:from-slate-900/45 dark:via-slate-900/25 dark:to-slate-800/20 sm:px-7 sm:py-6">
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-2/5 bg-gradient-to-l from-primary/12 to-transparent dark:from-cyan-400/10"
              aria-hidden
            />
            <div className="relative flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-text sm:text-xl">
                  Week at a glance
                </h2>
                <p className="mt-1 max-w-lg text-sm leading-relaxed text-slate-600 dark:text-muted">
                  Study minutes and average focus — spot heavy days and drift
                  early.
                </p>
              </div>
              <p className="text-xs font-medium tabular-nums text-slate-500 dark:text-muted/90">
                Last 7 days · local time
              </p>
            </div>
          </div>
          <div className="p-4 sm:p-5 md:p-6">
            <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-b from-white/40 via-white/25 to-sky-50/20 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl dark:border-white/12 dark:from-slate-950/55 dark:via-slate-900/35 dark:to-slate-950/50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="rounded-[14px] bg-slate-100/35 p-3 dark:bg-slate-950/25 sm:p-4 md:p-5">
                {stats ? <WeeklyFocusChart days={stats.report.days} /> : null}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
