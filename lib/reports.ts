import type { StudySession } from "./types";

export type DayAgg = {
  dateKey: string;
  label: string;
  studyMinutes: number;
  breakMinutes: number;
  avgFocus: number | null;
  sessions: number;
  distractionEvents: number;
};

export type WeeklyReport = {
  days: DayAgg[];
  totalStudyMinutes: number;
  totalBreakMinutes: number;
  avgFocusWeek: number | null;
  sessionsCompleted: number;
  streak: number;
  bestDay: string | null;
  worstDay: string | null;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateKey(d: Date) {
  return startOfDay(d).toISOString().slice(0, 10);
}

function formatLabel(dateKeyStr: string) {
  const d = new Date(dateKeyStr + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** Last 7 calendar days including today */
export function buildWeeklyReport(sessions: StudySession[]): WeeklyReport {
  const today = startOfDay(new Date());
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dayKeys.push(dateKey(d));
  }

  const byDay = new Map<string, DayAgg>();
  for (const k of dayKeys) {
    byDay.set(k, {
      dateKey: k,
      label: formatLabel(k),
      studyMinutes: 0,
      breakMinutes: 0,
      avgFocus: null,
      sessions: 0,
      distractionEvents: 0,
    });
  }

  for (const s of sessions) {
    const k = dateKey(new Date(s.startedAt));
    if (!byDay.has(k)) continue;
    const row = byDay.get(k)!;
    row.studyMinutes += s.focusMs / 60000;
    row.breakMinutes += s.breakMs / 60000;
    row.sessions += 1;
    row.distractionEvents += s.distractionEvents;
    // running weighted average for focus
    const prevW = row.avgFocus === null ? 0 : row.avgFocus * (row.sessions - 1);
    row.avgFocus = (prevW + s.averageFocus) / row.sessions;
  }

  for (const row of Array.from(byDay.values())) {
    if (row.avgFocus !== null) row.avgFocus = Math.round(row.avgFocus);
    row.studyMinutes = Math.round(row.studyMinutes);
    row.breakMinutes = Math.round(row.breakMinutes);
  }

  const days = dayKeys.map((k) => byDay.get(k)!);
  const totalStudyMinutes = days.reduce((a, d) => a + d.studyMinutes, 0);
  const totalBreakMinutes = days.reduce((a, d) => a + d.breakMinutes, 0);
  const sessionsCompleted = days.reduce((a, d) => a + d.sessions, 0);
  const focusDays = days.filter((d) => d.avgFocus !== null);
  const avgFocusWeek =
    focusDays.length === 0
      ? null
      : Math.round(
          focusDays.reduce((a, d) => a + (d.avgFocus ?? 0), 0) /
            focusDays.length,
        );

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].sessions > 0) streak++;
    else break;
  }

  let bestDay: string | null = null;
  let worstDay: string | null = null;
  let bestScore = -1;
  let worstScore = 101;
  for (const d of days) {
    if (d.sessions === 0) continue;
    const f = d.avgFocus ?? 0;
    if (f > bestScore) {
      bestScore = f;
      bestDay = d.label;
    }
    if (f < worstScore) {
      worstScore = f;
      worstDay = d.label;
    }
  }

  return {
    days,
    totalStudyMinutes,
    totalBreakMinutes,
    avgFocusWeek,
    sessionsCompleted,
    streak,
    bestDay,
    worstDay,
  };
}
