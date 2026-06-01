/**
 * Progression orchestration. `applySessionProgression` is the single entry
 * point called when a study session ends: it awards XP, detects level/rank-ups,
 * grants rank-locked cosmetics (exactly once), advances the streak, updates
 * daily/weekly quests, and unlocks achievements. `loadProgressionSnapshot`
 * builds the read-model used across the UI.
 */

import { getSessionsForUser } from "@/lib/storage";
import type { StudySession } from "@/lib/types";
import type { AchievementId } from "./achievements";
import { ACHIEVEMENTS, evaluateAchievements } from "./achievements";
import {
  COSMETICS_BY_ID,
  entitledCosmeticIds,
  type CosmeticDef,
} from "./cosmetics";
import {
  DEFAULT_XP_STATE,
  type BuddyState,
  type ProfileLoadout,
  type UserXpState,
} from "./profile";
import {
  getBuddy,
  getLoadout,
  getOwnedCosmetics,
  getStreakState,
  getUnlockedAchievementIds,
  getXpState,
  grantAchievements,
  grantCosmetics,
  recordPrestige,
  saveQuests,
  saveStreakState,
  saveXpState,
  buddyStudiedToday,
  ensureQuests,
} from "./progression-storage";
import {
  aggregateSessions,
  applyAggregatesToQuests,
  dailyPeriodKey,
  generateDailyQuests,
  generateWeeklyQuest,
  weeklyPeriodKey,
  type Quest,
} from "./quests";
import {
  levelFromTotalXp,
  levelProgress,
  rankForLevel,
  xpRequiredForNextRank,
  type LevelProgress,
  type RankDef,
} from "./ranks";
import {
  registerStudyDay,
  type StreakMilestone,
  type StreakState,
} from "./streaks";
import { computeSessionXp, type XpBreakdownItem } from "./xp";

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sessionsToday(sessions: StudySession[], now = new Date()): StudySession[] {
  return sessions.filter((s) => isSameLocalDay(new Date(s.startedAt), now));
}

function sessionsThisWeek(sessions: StudySession[], now = new Date()): StudySession[] {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return sessions.filter((s) => new Date(s.startedAt) >= monday);
}

export type ProgressionSnapshot = {
  xp: number;
  level: number;
  prestige: number;
  progress: LevelProgress;
  rank: RankDef;
  xpForNextRank: number | null;
  loadout: ProfileLoadout;
  ownedCosmetics: string[];
  achievements: AchievementId[];
  streak: StreakState;
  dailyQuests: Quest[];
  weeklyQuest: Quest | null;
  buddy: BuddyState | null;
};

export async function loadProgressionSnapshot(
  userId: string,
): Promise<ProgressionSnapshot> {
  const [xpState, loadout, ownedCosmetics, achievements, streak, buddy, sessions] =
    await Promise.all([
      getXpState(userId),
      getLoadout(userId),
      getOwnedCosmetics(userId),
      getUnlockedAchievementIds(userId),
      getStreakState(userId),
      getBuddy(userId),
      getSessionsForUser(userId),
    ]);

  const dKey = dailyPeriodKey();
  const wKey = weeklyPeriodKey();
  const [storedDaily, storedWeekly] = await Promise.all([
    ensureQuests(userId, "daily", dKey, () => generateDailyQuests(userId, dKey)),
    ensureQuests(userId, "weekly", wKey, () => [
      generateWeeklyQuest(userId, wKey),
    ]),
  ]);

  // Display preview only — XP for completions is awarded on session end.
  const dailyAgg = aggregateSessions(sessionsToday(sessions));
  const weeklyAgg = aggregateSessions(sessionsThisWeek(sessions));
  const dailyQuests = applyAggregatesToQuests(storedDaily, dailyAgg).quests;
  const weeklyQuests = applyAggregatesToQuests(storedWeekly, weeklyAgg).quests;

  return {
    xp: xpState.xp,
    level: xpState.level,
    prestige: xpState.prestige,
    progress: levelProgress(xpState.xp),
    rank: rankForLevel(xpState.level),
    xpForNextRank: xpRequiredForNextRank(xpState.xp),
    loadout,
    ownedCosmetics,
    achievements,
    streak,
    dailyQuests,
    weeklyQuest: weeklyQuests[0] ?? null,
    buddy,
  };
}

export type ProgressionResult = {
  xpEarned: number;
  xpItems: XpBreakdownItem[];
  totalXp: number;
  oldLevel: number;
  newLevel: number;
  leveledUp: boolean;
  rankUp: boolean;
  rank: RankDef;
  previousRank: RankDef;
  progress: LevelProgress;
  prestige: number;
  grantedCosmetics: CosmeticDef[];
  completedQuests: Quest[];
  newAchievements: { id: AchievementId; title: string; description: string }[];
  streak: StreakState;
  streakMilestones: StreakMilestone[];
  freezeUsed: boolean;
  bounceBack: boolean;
};

export async function applySessionProgression(
  user: { id: string; name: string },
  session: StudySession,
  ctx: {
    allSessions: StudySession[];
    monthlyRank: number | null;
    allTimeRank: number | null;
    currentMonthKey: string;
  },
): Promise<ProgressionResult> {
  const userId = user.id;
  const [xpState, streakPrev, buddy] = await Promise.all([
    getXpState(userId),
    getStreakState(userId),
    getBuddy(userId),
  ]);

  const now = new Date();
  const todaySessions = sessionsToday(ctx.allSessions, now);
  const weekSessions = sessionsThisWeek(ctx.allSessions, now);
  const isDailyFirst = todaySessions.length <= 1;

  const buddyActiveToday =
    buddy?.status === "active"
      ? await buddyStudiedToday(buddy.buddyId).catch(() => false)
      : false;

  // 1) Base session XP.
  const sessionXp = computeSessionXp(session, {
    isDailyFirst,
    buddyActiveToday,
    prestige: xpState.prestige,
  });
  const xpItems: XpBreakdownItem[] = [...sessionXp.items];
  let xpEarned = sessionXp.total;

  // 2) Streak (study day) + milestones.
  const streakUpdate = registerStudyDay(streakPrev, now);
  let streakMilestoneXp = 0;
  for (const m of streakUpdate.milestones) streakMilestoneXp += m.rewardXp;
  if (streakMilestoneXp > 0) {
    xpItems.push({
      key: "streak",
      label: "Streak milestone",
      amount: streakMilestoneXp,
    });
    xpEarned += streakMilestoneXp;
  }
  await saveStreakState(userId, streakUpdate.state);

  // 3) Quests (daily + weekly) — award newly completed.
  const dKey = dailyPeriodKey(now);
  const wKey = weeklyPeriodKey(now);
  const [dailyStored, weeklyStored] = await Promise.all([
    ensureQuests(userId, "daily", dKey, () => generateDailyQuests(userId, dKey)),
    ensureQuests(userId, "weekly", wKey, () => [
      generateWeeklyQuest(userId, wKey),
    ]),
  ]);
  const dailyRes = applyAggregatesToQuests(
    dailyStored,
    aggregateSessions(todaySessions),
  );
  const weeklyRes = applyAggregatesToQuests(
    weeklyStored,
    aggregateSessions(weekSessions),
  );
  const completedQuests = [...dailyRes.newlyCompleted, ...weeklyRes.newlyCompleted];
  await saveQuests(userId, [...dailyRes.quests, ...weeklyRes.quests]);
  let questXp = 0;
  for (const q of completedQuests) questXp += q.rewardXp;
  if (questXp > 0) {
    xpItems.push({ key: "quests", label: "Quests completed", amount: questXp });
    xpEarned += questXp;
  }

  // 4) Achievements — award reward XP for newly unlocked.
  const evaluated = evaluateAchievements(ctx.allSessions, {
    monthlyRank: ctx.monthlyRank,
    allTimeRank: ctx.allTimeRank,
    currentMonthKey: ctx.currentMonthKey,
    currentStreak: streakUpdate.state.current,
    longestStreak: streakUpdate.state.longest,
    hasBuddy: buddy?.status === "active",
  });
  const freshAchievements = await grantAchievements(userId, evaluated);
  let achievementXp = 0;
  for (const id of freshAchievements) achievementXp += ACHIEVEMENTS[id].rewardXp;
  if (achievementXp > 0) {
    xpItems.push({
      key: "achievements",
      label: "Achievements unlocked",
      amount: achievementXp,
    });
    xpEarned += achievementXp;
  }

  // 5) Commit XP + level/rank.
  const oldLevel = levelFromTotalXp(xpState.xp);
  const previousRank = rankForLevel(oldLevel);
  const totalXp = xpState.xp + xpEarned;
  const newLevel = levelFromTotalXp(totalXp);
  const rank = rankForLevel(newLevel);
  await saveXpState(userId, {
    xp: totalXp,
    level: newLevel,
    prestige: xpState.prestige,
  });

  // 6) Grant rank-locked cosmetics (dedupe handled by storage).
  const entitled = entitledCosmeticIds(newLevel, xpState.prestige);
  const grantedIds = await grantCosmetics(userId, entitled);
  const grantedCosmetics = grantedIds
    .map((id) => COSMETICS_BY_ID[id])
    .filter((c): c is CosmeticDef => Boolean(c));

  return {
    xpEarned,
    xpItems,
    totalXp,
    oldLevel,
    newLevel,
    leveledUp: newLevel > oldLevel,
    rankUp: rank.slug !== previousRank.slug,
    rank,
    previousRank,
    progress: levelProgress(totalXp),
    prestige: xpState.prestige,
    grantedCosmetics,
    completedQuests,
    newAchievements: freshAchievements.map((id) => ({
      id,
      title: ACHIEVEMENTS[id].title,
      description: ACHIEVEMENTS[id].description,
    })),
    streak: streakUpdate.state,
    streakMilestones: streakUpdate.milestones,
    freezeUsed: streakUpdate.freezeUsed,
    bounceBack: streakUpdate.bounceBack,
  };
}

/** Prestige: only at max level. Resets XP/level, keeps cosmetics, +1 prestige. */
export async function performPrestige(
  userId: string,
): Promise<{ ok: boolean; prestige: number; error?: string }> {
  const xpState = await getXpState(userId);
  if (xpState.level < 50) {
    return { ok: false, prestige: xpState.prestige, error: "Reach Level 50 to prestige." };
  }
  const next: UserXpState = {
    xp: 0,
    level: 1,
    prestige: xpState.prestige + 1,
  };
  await saveXpState(userId, next);
  await recordPrestige(userId, next.prestige);
  // Prestige-gated cosmetics (e.g. Prestige Halo) become available immediately.
  await grantCosmetics(userId, entitledCosmeticIds(1, next.prestige));
  return { ok: true, prestige: next.prestige };
}

export { DEFAULT_XP_STATE };
