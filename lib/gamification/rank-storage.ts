import type { AchievementId } from "./achievements";

type Snapshot = {
  monthKey: string;
  monthlyRank: number | null;
  allTimeRank: number | null;
};

function snapshotKey(userId: string) {
  return `studytime_rank_snapshot_${userId}`;
}

export function getRankSnapshot(userId: string): Snapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(snapshotKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

export function saveRankSnapshot(userId: string, snap: Snapshot) {
  localStorage.setItem(snapshotKey(userId), JSON.stringify(snap));
}

function achievementsKey(userId: string) {
  return `studytime_achievements_${userId}`;
}

export function getUnlockedAchievements(userId: string): AchievementId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(achievementsKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as AchievementId[];
  } catch {
    return [];
  }
}

/** Persists union(previous, evaluated) so badges never disappear when criteria slip. */
export function unionAchievements(
  userId: string,
  evaluatedMatching: AchievementId[],
): AchievementId[] {
  const merged = new Set([
    ...getUnlockedAchievements(userId),
    ...evaluatedMatching,
  ]);
  const arr = Array.from(merged);
  localStorage.setItem(achievementsKey(userId), JSON.stringify(arr));
  return arr;
}
