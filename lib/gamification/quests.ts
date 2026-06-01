/**
 * Dynamic quest generator. Daily quests reset every calendar day; the weekly
 * challenge resets every Monday. Generation is deterministic per
 * (user, period) via a seeded RNG, so the same 3 quests render on every reload
 * until the period rolls over.
 */

import type { StudySession } from "@/lib/types";

export type QuestMetric =
  | "study_minutes"
  | "sessions"
  | "pomodoro"
  | "focus_percent";

export type QuestScope = "daily" | "weekly";

export type QuestTemplate = {
  templateId: string;
  scope: QuestScope;
  title: string;
  metric: QuestMetric;
  target: number;
  rewardXp: number;
};

export type Quest = {
  id: string;
  templateId: string;
  scope: QuestScope;
  periodKey: string;
  title: string;
  metric: QuestMetric;
  target: number;
  progress: number;
  rewardXp: number;
  completed: boolean;
};

const DAILY_TEMPLATES: QuestTemplate[] = [
  { templateId: "d_study_45", scope: "daily", title: "Study 45 minutes", metric: "study_minutes", target: 45, rewardXp: 60 },
  { templateId: "d_study_90", scope: "daily", title: "Deep work: 90 minutes", metric: "study_minutes", target: 90, rewardXp: 110 },
  { templateId: "d_pomodoro_2", scope: "daily", title: "Complete 2 Pomodoro cycles", metric: "pomodoro", target: 2, rewardXp: 70 },
  { templateId: "d_focus_90", scope: "daily", title: "Reach 90% focus in a session", metric: "focus_percent", target: 90, rewardXp: 80 },
  { templateId: "d_focus_80", scope: "daily", title: "Hold 80% focus in a session", metric: "focus_percent", target: 80, rewardXp: 60 },
  { templateId: "d_sessions_3", scope: "daily", title: "Finish 3 study sessions", metric: "sessions", target: 3, rewardXp: 90 },
];

const WEEKLY_TEMPLATES: QuestTemplate[] = [
  { templateId: "w_study_300", scope: "weekly", title: "Study 300 minutes this week", metric: "study_minutes", target: 300, rewardXp: 250 },
  { templateId: "w_sessions_10", scope: "weekly", title: "Finish 10 sessions this week", metric: "sessions", target: 10, rewardXp: 250 },
  { templateId: "w_pomodoro_12", scope: "weekly", title: "Complete 12 Pomodoro cycles", metric: "pomodoro", target: 12, rewardXp: 250 },
];

export const QUEST_TEMPLATES = [...DAILY_TEMPLATES, ...WEEKLY_TEMPLATES];

const TEMPLATE_BY_ID: Record<string, QuestTemplate> = Object.fromEntries(
  QUEST_TEMPLATES.map((t) => [t.templateId, t]),
);

/** Local calendar day key (yyyy-mm-dd). */
export function dailyPeriodKey(d: Date = new Date()): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday-of-week key (yyyy-mm-dd) — weekly challenge resets every Monday. */
export function weeklyPeriodKey(d: Date = new Date()): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 = Sun
  const diffToMonday = (day + 6) % 7;
  x.setDate(x.getDate() - diffToMonday);
  return dailyPeriodKey(x);
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickDistinct<T>(items: T[], count: number, rnd: () => number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    const idx = Math.floor(rnd() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function questFromTemplate(
  userId: string,
  periodKey: string,
  t: QuestTemplate,
): Quest {
  return {
    id: `${t.templateId}_${periodKey}`,
    templateId: t.templateId,
    scope: t.scope,
    periodKey,
    title: t.title,
    metric: t.metric,
    target: t.target,
    progress: 0,
    rewardXp: t.rewardXp,
    completed: false,
  };
}

/** Generate the 3 daily quests for a user + day (deterministic). */
export function generateDailyQuests(
  userId: string,
  periodKey: string = dailyPeriodKey(),
): Quest[] {
  const rnd = mulberry32(hashSeed(`${userId}|daily|${periodKey}`));
  return pickDistinct(DAILY_TEMPLATES, 3, rnd).map((t) =>
    questFromTemplate(userId, periodKey, t),
  );
}

/** Generate the single weekly challenge for a user + ISO week (deterministic). */
export function generateWeeklyQuest(
  userId: string,
  periodKey: string = weeklyPeriodKey(),
): Quest {
  const rnd = mulberry32(hashSeed(`${userId}|weekly|${periodKey}`));
  const t = pickDistinct(WEEKLY_TEMPLATES, 1, rnd)[0];
  return questFromTemplate(userId, periodKey, t);
}

export type QuestAggregates = {
  studyMinutes: number;
  sessions: number;
  pomodoroCycles: number;
  bestFocusPercent: number;
};

/** Aggregate stats over an already-filtered list of sessions (a day or week). */
export function aggregateSessions(sessions: StudySession[]): QuestAggregates {
  let focusMs = 0;
  let best = 0;
  for (const s of sessions) {
    focusMs += s.focusMs;
    best = Math.max(best, s.focusedRatio, s.averageFocus);
  }
  return {
    studyMinutes: Math.round(focusMs / 60_000),
    sessions: sessions.length,
    // One Pomodoro cycle ≈ 25 focused minutes (sessions don't persist block counts).
    pomodoroCycles: Math.floor(focusMs / (25 * 60_000)),
    bestFocusPercent: best,
  };
}

function progressForMetric(metric: QuestMetric, agg: QuestAggregates): number {
  switch (metric) {
    case "study_minutes":
      return agg.studyMinutes;
    case "sessions":
      return agg.sessions;
    case "pomodoro":
      return agg.pomodoroCycles;
    case "focus_percent":
      return agg.bestFocusPercent;
    default:
      return 0;
  }
}

/**
 * Recompute quest progress from period aggregates (idempotent). Returns the
 * updated quests plus the ids that *newly* completed during this update.
 */
export function applyAggregatesToQuests(
  quests: Quest[],
  agg: QuestAggregates,
): { quests: Quest[]; newlyCompleted: Quest[] } {
  const newlyCompleted: Quest[] = [];
  const next = quests.map((q) => {
    const progress = Math.min(
      q.target,
      Math.max(q.progress, progressForMetric(q.metric, agg)),
    );
    const completed = progress >= q.target;
    if (completed && !q.completed) {
      newlyCompleted.push({ ...q, progress, completed });
    }
    return { ...q, progress, completed };
  });
  return { quests: next, newlyCompleted };
}

export function getTemplate(templateId: string): QuestTemplate | undefined {
  return TEMPLATE_BY_ID[templateId];
}
