import type { StudySession } from "@/lib/types";
import {
  computeStudyStreak,
  focusAccuracyPercent,
  hasDeepFocusChampionSession,
  hasNightOwlSession,
  sessionsInMonth,
  totalFocusPoints,
} from "./stats";

export type AchievementId =
  | "focus_master"
  | "streak_7"
  | "top_100_global"
  | "night_owl"
  | "deep_focus_champion"
  | "monthly_top_performer"
  | "iron_focus"
  | "streak_14"
  | "streak_30"
  | "speed_demon"
  | "early_bird"
  | "buddy_bond"
  | "weekend_warrior";

export type AchievementCategory =
  | "focus"
  | "consistency"
  | "speed"
  | "social"
  | "seasonal";

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

export type AchievementIcon =
  | "target"
  | "flame"
  | "trophy"
  | "moon"
  | "zap"
  | "crown"
  | "rocket"
  | "users"
  | "snowflake"
  | "calendar"
  | "award"
  | "sunrise";

export type AchievementDef = {
  id: AchievementId;
  title: string;
  description: string;
  icon: AchievementIcon;
  category: AchievementCategory;
  rarity: AchievementRarity;
  /** XP awarded once when unlocked. */
  rewardXp: number;
  /** Legendary badges shimmer in the UI. */
  animated?: boolean;
};

export const ACHIEVEMENTS: Record<AchievementId, AchievementDef> = {
  focus_master: {
    id: "focus_master",
    title: "Focus Master",
    description: "Maintain ≥90% focus accuracy across your last 10 sessions.",
    icon: "target",
    category: "focus",
    rarity: "epic",
    rewardXp: 250,
  },
  deep_focus_champion: {
    id: "deep_focus_champion",
    title: "Deep Focus Champion",
    description: "Finish a session with ≥85 avg focus and ≥20 minutes focused.",
    icon: "zap",
    category: "focus",
    rarity: "rare",
    rewardXp: 150,
  },
  iron_focus: {
    id: "iron_focus",
    title: "Iron Focus",
    description: "Complete a single focus block of 45 minutes or more.",
    icon: "award",
    category: "focus",
    rarity: "rare",
    rewardXp: 150,
  },
  night_owl: {
    id: "night_owl",
    title: "Night Owl",
    description: "Complete a study session between 10 PM and 6 AM.",
    icon: "moon",
    category: "seasonal",
    rarity: "common",
    rewardXp: 80,
  },
  early_bird: {
    id: "early_bird",
    title: "Early Bird",
    description: "Complete a study session between 4 AM and 7 AM.",
    icon: "sunrise",
    category: "seasonal",
    rarity: "rare",
    rewardXp: 120,
  },
  weekend_warrior: {
    id: "weekend_warrior",
    title: "Weekend Warrior",
    description: "Study on both Saturday and Sunday.",
    icon: "calendar",
    category: "seasonal",
    rarity: "common",
    rewardXp: 100,
  },
  streak_7: {
    id: "streak_7",
    title: "7-Day Study Streak",
    description: "Study at least once per day for 7 consecutive days.",
    icon: "flame",
    category: "consistency",
    rarity: "common",
    rewardXp: 120,
  },
  streak_14: {
    id: "streak_14",
    title: "Fortnight Flame",
    description: "Keep a 14-day study streak alive.",
    icon: "flame",
    category: "consistency",
    rarity: "rare",
    rewardXp: 220,
  },
  streak_30: {
    id: "streak_30",
    title: "Unbreakable",
    description: "Reach a 30-day study streak.",
    icon: "flame",
    category: "consistency",
    rarity: "legendary",
    rewardXp: 500,
    animated: true,
  },
  speed_demon: {
    id: "speed_demon",
    title: "Speed Demon",
    description: "Finish 3 study sessions in a single day.",
    icon: "rocket",
    category: "speed",
    rarity: "rare",
    rewardXp: 180,
  },
  buddy_bond: {
    id: "buddy_bond",
    title: "Buddy Bond",
    description: "Pair up with a study buddy.",
    icon: "users",
    category: "social",
    rarity: "common",
    rewardXp: 100,
  },
  top_100_global: {
    id: "top_100_global",
    title: "Top 100 Global User",
    description: "Reach top 100 on the all-time leaderboard.",
    icon: "trophy",
    category: "social",
    rarity: "epic",
    rewardXp: 300,
  },
  monthly_top_performer: {
    id: "monthly_top_performer",
    title: "Monthly Top Performer",
    description: "Rank in the top 10 for the current monthly leaderboard.",
    icon: "crown",
    category: "social",
    rarity: "legendary",
    rewardXp: 400,
    animated: true,
  },
};

export const ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENTS) as AchievementId[];

export const RARITY_ORDER: Record<AchievementRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

function startOfDayKey(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function maxSessionsInOneDay(sessions: StudySession[]): number {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    if (s.focusMs <= 0) continue;
    const k = startOfDayKey(new Date(s.startedAt));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let max = 0;
  for (const v of counts.values()) max = Math.max(max, v);
  return max;
}

function hasEarlyBirdSession(sessions: StudySession[]): boolean {
  return sessions.some((s) => {
    const h = new Date(s.startedAt).getHours();
    return h >= 4 && h < 7;
  });
}

function hasWeekendPair(sessions: StudySession[]): boolean {
  let sat = false;
  let sun = false;
  for (const s of sessions) {
    if (s.focusMs <= 0) continue;
    const day = new Date(s.startedAt).getDay();
    if (day === 6) sat = true;
    if (day === 0) sun = true;
  }
  return sat && sun;
}

export type EvaluateContext = {
  monthlyRank: number | null;
  allTimeRank: number | null;
  currentMonthKey: string;
  currentStreak?: number;
  longestStreak?: number;
  hasBuddy?: boolean;
};

export function evaluateAchievements(
  sessions: StudySession[],
  opts: EvaluateContext,
): AchievementId[] {
  const unlocked: AchievementId[] = [];
  const liveStreak = computeStudyStreak(sessions);
  const streak = Math.max(opts.currentStreak ?? 0, liveStreak);
  const longest = Math.max(opts.longestStreak ?? 0, streak);
  const accuracy = focusAccuracyPercent(sessions);

  if (streak >= 7 || longest >= 7) unlocked.push("streak_7");
  if (streak >= 14 || longest >= 14) unlocked.push("streak_14");
  if (streak >= 30 || longest >= 30) unlocked.push("streak_30");

  if (hasNightOwlSession(sessions)) unlocked.push("night_owl");
  if (hasEarlyBirdSession(sessions)) unlocked.push("early_bird");
  if (hasWeekendPair(sessions)) unlocked.push("weekend_warrior");
  if (hasDeepFocusChampionSession(sessions))
    unlocked.push("deep_focus_champion");

  if (sessions.some((s) => s.focusMs >= 45 * 60_000)) unlocked.push("iron_focus");
  if (maxSessionsInOneDay(sessions) >= 3) unlocked.push("speed_demon");

  if (opts.hasBuddy) unlocked.push("buddy_bond");

  if (sessions.length >= 10) {
    const last10 = sessions.slice(-10);
    if (focusAccuracyPercent(last10) >= 90) unlocked.push("focus_master");
  } else if (
    sessions.length >= 5 &&
    accuracy >= 92 &&
    totalFocusPoints(sessions) >= 400
  ) {
    unlocked.push("focus_master");
  }

  if (opts.allTimeRank != null && opts.allTimeRank <= 100) {
    unlocked.push("top_100_global");
  }

  const monthSessions = sessionsInMonth(sessions, opts.currentMonthKey);
  if (
    monthSessions.length > 0 &&
    opts.monthlyRank != null &&
    opts.monthlyRank <= 10
  ) {
    unlocked.push("monthly_top_performer");
  }

  return Array.from(new Set(unlocked));
}
