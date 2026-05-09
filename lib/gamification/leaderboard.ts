import type { StudySession, UserRecord } from "@/lib/types";
import {
  computeStudyStreak,
  currentYearMonth,
  focusAccuracyPercent,
  sessionsInMonth,
  totalFocusPoints,
  totalStudyHours,
} from "./stats";

export type LeaderboardRow = {
  id: string;
  rank: number;
  name: string;
  avatarUrl: string;
  totalFocusScore: number;
  streakDays: number;
  studyHours: number;
  focusAccuracy: number;
  isCurrentUser: boolean;
  /** Internal sort key */
  composite: number;
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function avatarUrlForSeed(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

/** Synthetic global competitors — deterministic from seed so leaderboard is stable per month. */
function syntheticRows(
  count: number,
  seedStr: string,
): Omit<LeaderboardRow, "rank" | "isCurrentUser">[] {
  let seedSum = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seedSum += seedStr.charCodeAt(i);
  }
  const seed = seedSum % 2147483647 || 1;
  const rnd = mulberry32(seed);
  const first = [
    "Alex",
    "Jordan",
    "Sam",
    "Riley",
    "Casey",
    "Morgan",
    "Quinn",
    "Avery",
    "Skyler",
    "Reese",
  ];
  const last = [
    "Kim",
    "Nguyen",
    "Patel",
    "Silva",
    "Park",
    "Lopez",
    "Chen",
    "Singh",
    "Reed",
    "Fox",
  ];
  const out: Omit<LeaderboardRow, "rank" | "isCurrentUser">[] = [];
  for (let i = 0; i < count; i++) {
    const r = rnd();
    const name = `${first[Math.floor(rnd() * first.length)]} ${last[Math.floor(rnd() * last.length)]}`;
    const id = `bot_${seedStr}_${i}`;
    const points = Math.round(800 + r * 12000 + rnd() * 4000);
    const streak = Math.min(120, Math.floor(rnd() * 45));
    const hours = Math.round((rnd() * 80 + 5) * 10) / 10;
    const accuracy = Math.min(99, Math.round(55 + rnd() * 44));
    const composite = Math.round(
      points * 1 + streak * 180 + hours * 70 + accuracy * 40,
    );
    out.push({
      id,
      name,
      avatarUrl: avatarUrlForSeed(id + name),
      totalFocusScore: points,
      streakDays: streak,
      studyHours: hours,
      focusAccuracy: accuracy,
      composite,
    });
  }
  return out;
}

function rowFromUser(
  user: Pick<UserRecord, "id" | "name">,
  sessions: StudySession[],
  isCurrentUser: boolean,
): Omit<LeaderboardRow, "rank"> {
  const points = totalFocusPoints(sessions);
  const streak = computeStudyStreak(sessions);
  const hours = totalStudyHours(sessions);
  const accuracy = focusAccuracyPercent(sessions);
  const composite = Math.round(
    points * 1 + streak * 180 + hours * 70 + accuracy * 40,
  );
  return {
    id: user.id,
    name: user.name || "Student",
    avatarUrl: avatarUrlForSeed(user.id + user.name),
    totalFocusScore: points,
    streakDays: streak,
    studyHours: hours,
    focusAccuracy: accuracy,
    isCurrentUser,
    composite,
  };
}

export type LeaderboardResult = {
  rows: LeaderboardRow[];
  userRank: number | null;
  userRow: LeaderboardRow | null;
};

function assignRanks(sorted: LeaderboardRow[]): LeaderboardRow[] {
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function buildMonthlyLeaderboard(
  currentUser: Pick<UserRecord, "id" | "name">,
  allSessions: StudySession[],
  yearMonth: string = currentYearMonth(),
): LeaderboardResult {
  const monthSessions = sessionsInMonth(allSessions, yearMonth);
  const userRowFull = rowFromUser(currentUser, monthSessions, true);
  const bots = syntheticRows(96, `m_${yearMonth}`).map((b) => ({
    ...b,
    isCurrentUser: false,
    rank: 0,
  }));
  const merged: LeaderboardRow[] = [
    ...bots,
    {
      ...userRowFull,
      rank: 0,
    },
  ];
  merged.sort((a, b) => b.composite - a.composite);
  const ranked = assignRanks(merged);
  const userRow = ranked.find((r) => r.isCurrentUser) ?? null;
  return {
    rows: ranked,
    userRank: userRow?.rank ?? null,
    userRow,
  };
}

export function buildAllTimeLeaderboard(
  currentUser: Pick<UserRecord, "id" | "name">,
  allSessions: StudySession[],
): LeaderboardResult {
  const userRowFull = rowFromUser(currentUser, allSessions, true);
  const bots = syntheticRows(96, "alltime_v1").map((b) => ({
    ...b,
    isCurrentUser: false,
    rank: 0,
  }));
  const merged: LeaderboardRow[] = [
    ...bots,
    { ...userRowFull, rank: 0 },
  ];
  merged.sort((a, b) => b.composite - a.composite);
  const ranked = assignRanks(merged);
  const userRow = ranked.find((r) => r.isCurrentUser) ?? null;
  return {
    rows: ranked,
    userRank: userRow?.rank ?? null,
    userRow,
  };
}

/** Top N for display; always include current user row if outside top N */
export function sliceLeaderboardForDisplay(
  result: LeaderboardResult,
  topN: number,
): { topRows: LeaderboardRow[]; userOutsideTop: LeaderboardRow | null } {
  const topRows = result.rows.slice(0, topN);
  const ur = result.userRow;
  if (!ur || ur.rank <= topN) {
    return { topRows, userOutsideTop: null };
  }
  return { topRows, userOutsideTop: ur };
}
