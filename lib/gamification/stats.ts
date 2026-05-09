import type { StudySession } from "@/lib/types";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dateKey(d: Date) {
  return startOfDay(d).toISOString().slice(0, 10);
}

/** Focus points: duration-weighted quality (larger sessions with higher avg focus score more). */
export function sessionFocusPoints(s: StudySession): number {
  const mins = s.focusMs / 60_000;
  return Math.round(mins * (s.averageFocus / 100) * 12);
}

export function totalFocusPoints(sessions: StudySession[]): number {
  return sessions.reduce((a, s) => a + sessionFocusPoints(s), 0);
}

export function totalStudyHours(sessions: StudySession[]): number {
  const ms = sessions.reduce((a, s) => a + s.focusMs, 0);
  return Math.round((ms / 3_600_000) * 10) / 10;
}

/** Weighted average focusedRatio by focus time */
export function focusAccuracyPercent(sessions: StudySession[]): number {
  let w = 0;
  let sum = 0;
  for (const s of sessions) {
    if (s.focusMs <= 0) continue;
    sum += s.focusedRatio * s.focusMs;
    w += s.focusMs;
  }
  return w <= 0 ? 0 : Math.round(sum / w);
}

/** Sessions that started in calendar month YYYY-MM */
export function sessionsInMonth(
  sessions: StudySession[],
  yearMonth: string,
): StudySession[] {
  return sessions.filter((s) => s.startedAt.slice(0, 7) === yearMonth);
}

export function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Consecutive calendar days with ≥1 focus session (focusMs > 0).
 * If no session today, streak can still count from yesterday backward.
 */
export function computeStudyStreak(sessions: StudySession[]): number {
  const days = new Set<string>();
  for (const s of sessions) {
    if (s.focusMs <= 0) continue;
    days.add(dateKey(new Date(s.startedAt)));
  }
  const today = startOfDay(new Date());
  const cursor = new Date(today);
  if (!days.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (days.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Night owl: ≥1 session with local hour 22–6 */
export function hasNightOwlSession(sessions: StudySession[]): boolean {
  for (const s of sessions) {
    const h = new Date(s.startedAt).getHours();
    if (h >= 22 || h < 6) return true;
  }
  return false;
}

/** Deep focus: single session avg ≥85 and ≥20 min focus */
export function hasDeepFocusChampionSession(sessions: StudySession[]): boolean {
  return sessions.some(
    (s) => s.averageFocus >= 85 && s.focusMs >= 20 * 60_000,
  );
}
