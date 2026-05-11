import type { LeaderboardResult } from "./leaderboard";
import { currentYearMonth } from "./stats";

type Entry = {
  userId: string;
  monthKey: string;
  data: { monthly: LeaderboardResult; all: LeaderboardResult };
  ts: number;
};

const TTL_MS = 90_000;
let entry: Entry | null = null;

export function peekLeaderboardCache(
  userId: string,
): { monthly: LeaderboardResult; all: LeaderboardResult } | null {
  if (!entry || entry.userId !== userId) return null;
  if (entry.monthKey !== currentYearMonth()) return null;
  if (Date.now() - entry.ts > TTL_MS) return null;
  return entry.data;
}

export function setLeaderboardCache(
  userId: string,
  data: { monthly: LeaderboardResult; all: LeaderboardResult },
) {
  entry = {
    userId,
    monthKey: currentYearMonth(),
    data,
    ts: Date.now(),
  };
}

export function clearLeaderboardCache() {
  entry = null;
}
