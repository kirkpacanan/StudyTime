"use client";

import { DailyBreakdown } from "@/components/DailyBreakdown";
import { WeeklyFocusChart } from "@/components/WeeklyFocusChart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { buildWeeklyReport, type WeeklyReport } from "@/lib/reports";
import { getSessionsForUser } from "@/lib/storage";
import { BarChart3, Clock, Flame, Target } from "lucide-react";
import { useEffect, useState } from "react";

export default function ReportsPage() {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const [report, setReport] = useState<WeeklyReport | null>(null);

  useEffect(() => {
    void tick;
    if (!user) {
      setReport(null);
      return;
    }
    let cancelled = false;
    void getSessionsForUser(user.id).then((sessions) => {
      if (!cancelled) setReport(buildWeeklyReport(sessions));
    });
    return () => {
      cancelled = true;
    };
  }, [user, tick]);

  function downloadWeeklyJson() {
    if (!report || !user) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      userId: user.id,
      report,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studytime-weekly-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!user) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (!report) {
    return <p className="text-sm text-muted">No data yet.</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            Weekly performance
          </h1>
          <p className="mt-1 text-sm text-muted">
            Auto-generated from your saved sessions (last 7 days).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setTick((t) => t + 1)}>
            Refresh
          </Button>
          <Button type="button" onClick={downloadWeeklyJson}>
            Download report (.json)
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total study time"
          value={`${report.totalStudyMinutes} min`}
          hint="Sum of focus blocks this week"
          icon={Clock}
          accent="blue"
        />
        <StatCard
          title="Avg focus (week)"
          value={
            report.avgFocusWeek !== null ? `${report.avgFocusWeek}%` : "—"
          }
          hint="Across days with sessions"
          icon={Target}
          accent="green"
        />
        <StatCard
          title="Sessions completed"
          value={String(report.sessionsCompleted)}
          icon={BarChart3}
          accent="yellow"
        />
        <StatCard
          title="Streak"
          value={`${report.streak} day(s)`}
          hint="Ending today"
          icon={Flame}
          accent="green"
        />
      </div>

      {(report.bestDay || report.worstDay) && (
        <p className="text-sm text-muted">
          <span className="font-medium text-text">Best day:</span>{" "}
          {report.bestDay ?? "—"} ·{" "}
          <span className="font-medium text-text">Needs care:</span>{" "}
          {report.worstDay ?? "—"}
        </p>
      )}

      <Card className="p-4 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-text">
          Study minutes & average focus
        </h2>
        <WeeklyFocusChart days={report.days} />
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Daily breakdown
        </h2>
        <DailyBreakdown days={report.days} />
      </div>
    </div>
  );
}
