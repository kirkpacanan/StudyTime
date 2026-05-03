"use client";

import { StatCard } from "@/components/StatCard";
import { WeeklyFocusChart } from "@/components/WeeklyFocusChart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { buildWeeklyReport } from "@/lib/reports";
import { getSessionsForUser } from "@/lib/storage";
import { BarChart3, Clock, Flame, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
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
    return <p className="text-sm text-muted">Loading…</p>;
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          {greeting}, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">
          A calm blue workspace to support deep focus and gentle accountability.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Today · study time"
          value={stats ? `${stats.todayMinutes} min` : "—"}
          hint="Focused blocks logged today"
          icon={Clock}
          accent="blue"
        />
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
        <StatCard
          title="This week · sessions"
          value={stats ? String(stats.weekSessionCount) : "—"}
          hint="Last rolling 7 days"
          icon={BarChart3}
          accent="yellow"
        />
        <StatCard
          title="Streak"
          value={stats ? `${stats.report.streak} day(s)` : "—"}
          hint="Consecutive days with a session"
          icon={Flame}
          accent="green"
        />
      </div>

      <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">
            Ready for a focused block?
          </h2>
          <p className="mt-1 text-sm text-muted">
            Start a session to capture focus samples and update your weekly
            report.
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0 md:px-8"
          onClick={() => router.push("/session")}
        >
          Start study session
        </Button>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Week at a glance
        </h2>
        <Card className="p-4 md:p-6">
          {stats ? <WeeklyFocusChart days={stats.report.days} /> : null}
        </Card>
      </div>
    </div>
  );
}
