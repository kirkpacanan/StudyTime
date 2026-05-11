import type { StudySession, UserRecord } from "@/lib/types";
import {
  computeStudyStreak,
  currentYearMonth,
  focusAccuracyPercent,
  sessionsInMonth,
  totalFocusPoints,
  totalStudyHours,
} from "./stats";

export { currentYearMonth } from "./stats";

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

export type SupabaseLeaderboardRpcRow = {
  user_id: string;
  display_name: string | null;
  total_focus_score: number;
  streak_days: number;
  study_hours: number;
  focus_accuracy: number;
  composite_score: number;
};

export function avatarUrlForSeed(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
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

function assignRanks(sorted: Omit<LeaderboardRow, "rank">[]): LeaderboardRow[] {
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}

function finalizeLeaderboard(
  rowsWithoutRank: Omit<LeaderboardRow, "rank">[],
): LeaderboardResult {
  const sorted = [...rowsWithoutRank].sort((a, b) => b.composite - a.composite);
  const ranked = assignRanks(sorted);
  const userRow = ranked.find((r) => r.isCurrentUser) ?? null;
  return {
    rows: ranked,
    userRank: userRow?.rank ?? null,
    userRow,
  };
}

/** Merge server rows with the current user if they have no sessions yet (not returned by RPC). */
export function buildLeaderboardFromRpcRows(
  currentUser: Pick<UserRecord, "id" | "name">,
  rpcRows: SupabaseLeaderboardRpcRow[],
): LeaderboardResult {
  const mapped: Omit<LeaderboardRow, "rank">[] = rpcRows.map((r) => ({
    id: r.user_id,
    name: (r.display_name || "Student").trim() || "Student",
    avatarUrl: avatarUrlForSeed(r.user_id + (r.display_name || "")),
    totalFocusScore: Number(r.total_focus_score),
    streakDays: Number(r.streak_days),
    studyHours: Number(r.study_hours),
    focusAccuracy: Number(r.focus_accuracy),
    isCurrentUser: r.user_id === currentUser.id,
    composite: Number(r.composite_score),
  }));

  if (!mapped.some((r) => r.isCurrentUser)) {
    mapped.push({
      ...rowFromUser(currentUser, [], true),
    });
  }

  return finalizeLeaderboard(mapped);
}

/** Pooled leaderboard from every user's sessions (localStorage demo mode). */
export function buildLocalPooledLeaderboard(
  currentUser: Pick<UserRecord, "id" | "name">,
  mode: "monthly" | "all",
  allSessions: StudySession[],
  users: Pick<UserRecord, "id" | "name">[],
  yearMonth: string = currentYearMonth(),
): LeaderboardResult {
  const nameById = new Map(users.map((u) => [u.id, u.name || "Student"]));
  nameById.set(currentUser.id, currentUser.name || "Student");

  const byUser = new Map<string, StudySession[]>();
  for (const s of allSessions) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }

  const everyUserId = new Set<string>();
  for (const u of users) everyUserId.add(u.id);
  everyUserId.add(currentUser.id);
  for (const s of allSessions) everyUserId.add(s.userId);

  const rows: Omit<LeaderboardRow, "rank">[] = [];
  for (const uid of everyUserId) {
    const sess = byUser.get(uid) ?? [];
    const filtered =
      mode === "monthly" ? sessionsInMonth(sess, yearMonth) : sess;
    const name = nameById.get(uid) ?? "Student";
    rows.push(
      rowFromUser({ id: uid, name }, filtered, uid === currentUser.id),
    );
  }

  return finalizeLeaderboard(rows);
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
