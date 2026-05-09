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
  | "monthly_top_performer";

export type AchievementDef = {
  id: AchievementId;
  title: string;
  description: string;
  icon: "target" | "flame" | "trophy" | "moon" | "zap" | "crown";
};

export const ACHIEVEMENTS: Record<AchievementId, AchievementDef> = {
  focus_master: {
    id: "focus_master",
    title: "Focus Master",
    description: "Maintain ≥90% focus accuracy across your last 10 sessions.",
    icon: "target",
  },
  streak_7: {
    id: "streak_7",
    title: "7-Day Study Streak",
    description: "Study at least once per day for 7 consecutive days.",
    icon: "flame",
  },
  top_100_global: {
    id: "top_100_global",
    title: "Top 100 Global User",
    description: "Reach top 100 on the all-time leaderboard.",
    icon: "trophy",
  },
  night_owl: {
    id: "night_owl",
    title: "Night Owl",
    description: "Complete a study session between 10 PM and 6 AM.",
    icon: "moon",
  },
  deep_focus_champion: {
    id: "deep_focus_champion",
    title: "Deep Focus Champion",
    description: "Finish a session with ≥85 avg focus and ≥20 minutes focused.",
    icon: "zap",
  },
  monthly_top_performer: {
    id: "monthly_top_performer",
    title: "Monthly Top Performer",
    description: "Rank in the top 10 for the current monthly leaderboard.",
    icon: "crown",
  },
};

export function evaluateAchievements(
  sessions: StudySession[],
  opts: {
    monthlyRank: number | null;
    allTimeRank: number | null;
    currentMonthKey: string;
  },
): AchievementId[] {
  const unlocked: AchievementId[] = [];
  const streak = computeStudyStreak(sessions);
  const accuracy = focusAccuracyPercent(sessions);

  if (streak >= 7) unlocked.push("streak_7");

  if (hasNightOwlSession(sessions)) unlocked.push("night_owl");

  if (hasDeepFocusChampionSession(sessions)) unlocked.push("deep_focus_champion");

  if (sessions.length >= 10) {
    const last10 = sessions.slice(-10);
    if (focusAccuracyPercent(last10) >= 90) unlocked.push("focus_master");
  } else if (sessions.length >= 5 && accuracy >= 92 && totalFocusPoints(sessions) >= 400) {
    unlocked.push("focus_master");
  }

  if (opts.allTimeRank != null && opts.allTimeRank <= 100) {
    unlocked.push("top_100_global");
  }

  const monthSessions = sessionsInMonth(sessions, opts.currentMonthKey);
  if (monthSessions.length > 0 && opts.monthlyRank != null && opts.monthlyRank <= 10) {
    unlocked.push("monthly_top_performer");
  }

  return Array.from(new Set(unlocked));
}
