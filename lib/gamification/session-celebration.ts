import { isSupabaseEnabled } from "@/lib/supabase/config";
import {
  fetchLeaderboardAllTime,
  fetchLeaderboardMonthly,
} from "@/lib/storage-supabase";
import {
  getAllSessionsLocal,
  getSessionsForUser,
  getUsers,
} from "@/lib/storage";
import type { StudySession } from "@/lib/types";
import type { AchievementId } from "./achievements";
import {
  buildLeaderboardFromRpcRows,
  buildLocalPooledLeaderboard,
} from "./leaderboard";
import { getRankSnapshot, saveRankSnapshot } from "./rank-storage";
import {
  applySessionProgression,
  type ProgressionResult,
} from "./progression-service";
import {
  currentYearMonth,
  sessionFocusPoints,
  totalFocusPoints,
} from "./stats";

export type SessionCelebrationPayload = {
  pointsEarned: number;
  totalFocusPoints: number;
  monthlyRank: number | null;
  allTimeRank: number | null;
  monthlyRankDelta: number | null;
  allTimeRankDelta: number | null;
  streakDays: number;
  newlyUnlocked: { id: AchievementId; title: string; description: string }[];
  /** Full XP / level / rank / quest / cosmetic progression for this session. */
  progression: ProgressionResult | null;
};

export async function computeSessionCelebration(
  user: { id: string; name: string },
  latestSession: StudySession,
): Promise<SessionCelebrationPayload | null> {
  if (typeof window === "undefined") return null;

  const sessions = await getSessionsForUser(user.id);
  const monthKey = currentYearMonth();

  let monthlyLb;
  let allLb;
  if (isSupabaseEnabled()) {
    const [mRows, aRows] = await Promise.all([
      fetchLeaderboardMonthly(monthKey),
      fetchLeaderboardAllTime(),
    ]);
    monthlyLb = buildLeaderboardFromRpcRows(user, mRows);
    allLb = buildLeaderboardFromRpcRows(user, aRows);
  } else {
    const allLocal = getAllSessionsLocal();
    const users = getUsers();
    monthlyLb = buildLocalPooledLeaderboard(
      user,
      "monthly",
      allLocal,
      users,
      monthKey,
    );
    allLb = buildLocalPooledLeaderboard(user, "all", allLocal, users);
  }

  const prev = getRankSnapshot(user.id);
  const monthlyRankDelta =
    prev &&
    prev.monthKey === monthKey &&
    prev.monthlyRank != null &&
    monthlyLb.userRank != null
      ? prev.monthlyRank - monthlyLb.userRank
      : null;
  const allTimeRankDelta =
    prev && prev.allTimeRank != null && allLb.userRank != null
      ? prev.allTimeRank - allLb.userRank
      : null;

  saveRankSnapshot(user.id, {
    monthKey,
    monthlyRank: monthlyLb.userRank,
    allTimeRank: allLb.userRank,
  });

  // Run the full progression engine (XP, level/rank-ups, cosmetics, quests,
  // streak, achievements). This is the authoritative XP update on session end.
  let progression: ProgressionResult | null = null;
  try {
    progression = await applySessionProgression(user, latestSession, {
      allSessions: sessions,
      monthlyRank: monthlyLb.userRank,
      allTimeRank: allLb.userRank,
      currentMonthKey: monthKey,
    });
  } catch {
    progression = null;
  }

  const pointsEarned = sessionFocusPoints(latestSession);

  return {
    pointsEarned,
    totalFocusPoints: totalFocusPoints(sessions),
    monthlyRank: monthlyLb.userRank,
    allTimeRank: allLb.userRank,
    monthlyRankDelta,
    allTimeRankDelta,
    streakDays: progression?.streak.current ?? 0,
    newlyUnlocked: progression?.newAchievements ?? [],
    progression,
  };
}
