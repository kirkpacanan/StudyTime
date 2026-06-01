/**
 * Streak tracking: current/longest consecutive study days, milestone rewards,
 * streak-freeze tokens, and a bounce-back quest after a streak loss.
 */

export type StreakState = {
  current: number;
  longest: number;
  /** yyyy-mm-dd of the last counted study day. */
  lastStudyDate: string | null;
  /** Tokens that auto-protect a missed day. */
  freezeTokens: number;
  /** Milestones already awarded (days). */
  claimedMilestones: number[];
};

export const DEFAULT_STREAK: StreakState = {
  current: 0,
  longest: 0,
  lastStudyDate: null,
  freezeTokens: 0,
  claimedMilestones: [],
};

export type StreakMilestone = {
  days: number;
  rewardXp: number;
  freezeTokens: number;
  label: string;
};

export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 7, rewardXp: 150, freezeTokens: 1, label: "7-day streak" },
  { days: 14, rewardXp: 300, freezeTokens: 1, label: "14-day streak" },
  { days: 30, rewardXp: 700, freezeTokens: 2, label: "30-day streak" },
];

function dayKey(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(aKey: string, bKey: string): number {
  const a = new Date(`${aKey}T00:00:00`);
  const b = new Date(`${bKey}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export type StreakUpdate = {
  state: StreakState;
  /** True when this study day advanced the streak (vs. same-day repeat). */
  advanced: boolean;
  /** True when a freeze token absorbed a missed day. */
  freezeUsed: boolean;
  /** True when the streak was reset to 1 after a gap. */
  reset: boolean;
  /** Milestones newly reached on this update. */
  milestones: StreakMilestone[];
  /** True when a bounce-back opportunity should be offered. */
  bounceBack: boolean;
};

/**
 * Register a study day and return the updated streak. Idempotent for repeats on
 * the same calendar day. A single missed day is absorbed by a freeze token if
 * available; larger gaps reset the streak (offering a bounce-back quest).
 */
export function registerStudyDay(
  prev: StreakState,
  today: Date = new Date(),
): StreakUpdate {
  const todayKey = dayKey(today);
  const state: StreakState = {
    ...prev,
    claimedMilestones: [...prev.claimedMilestones],
  };

  let advanced = false;
  let freezeUsed = false;
  let reset = false;
  let bounceBack = false;

  if (!state.lastStudyDate) {
    state.current = 1;
    advanced = true;
  } else {
    const gap = daysBetween(state.lastStudyDate, todayKey);
    if (gap <= 0) {
      // Same day (or clock skew) — no change.
    } else if (gap === 1) {
      state.current += 1;
      advanced = true;
    } else if (gap === 2 && state.freezeTokens > 0) {
      state.freezeTokens -= 1;
      state.current += 1;
      advanced = true;
      freezeUsed = true;
    } else {
      state.current = 1;
      advanced = true;
      reset = true;
      bounceBack = true;
    }
  }

  if (advanced) state.lastStudyDate = todayKey;
  state.longest = Math.max(state.longest, state.current);

  const milestones: StreakMilestone[] = [];
  for (const m of STREAK_MILESTONES) {
    if (state.current >= m.days && !state.claimedMilestones.includes(m.days)) {
      state.claimedMilestones.push(m.days);
      state.freezeTokens += m.freezeTokens;
      milestones.push(m);
    }
  }

  return { state, advanced, freezeUsed, reset, milestones, bounceBack };
}

/** Next milestone the user is working toward (null once all are claimed). */
export function nextStreakMilestone(state: StreakState): StreakMilestone | null {
  return (
    STREAK_MILESTONES.find((m) => !state.claimedMilestones.includes(m.days)) ??
    null
  );
}
