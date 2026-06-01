/**
 * XP calculation service. Pure functions — given a completed session and a bit
 * of daily context, returns the XP a player earned and an itemized breakdown.
 *
 * Sources (per product spec):
 *  - Study session completed → scales with focus duration
 *  - Focus goal achieved (>80% focused ratio) → bonus
 *  - Perfect session (>95% average focus) → bonus
 *  - Daily first session → bonus
 *  - Daily quest / weekly challenge / achievement completion → handled by their
 *    own reward fields and added by the progression service
 *  - Study buddy: +20% if both completed a session the same day (multiplier)
 *
 * Prestige adds +10% per prestige level to all gained XP.
 */

import type { StudySession } from "@/lib/types";

export const XP = {
  /** XP per focused minute (base study reward). */
  perFocusMinute: 5,
  focusGoalBonus: 60,
  perfectSessionBonus: 120,
  dailyFirstSessionBonus: 40,
  /** Thresholds. */
  focusGoalRatio: 80,
  perfectAverage: 95,
  buddyMultiplier: 0.2,
  prestigePerLevel: 0.1,
} as const;

export type XpBreakdownItem = {
  key: string;
  label: string;
  amount: number;
};

export type SessionXpContext = {
  /** Is this the player's first saved session today? */
  isDailyFirst: boolean;
  /** Did the buddy also complete a session today? */
  buddyActiveToday: boolean;
  /** Current prestige level (0 when never prestiged). */
  prestige: number;
};

export type SessionXpResult = {
  /** Final XP after multipliers, rounded. */
  total: number;
  /** Sum before multipliers. */
  base: number;
  buddyBonus: number;
  prestigeBonus: number;
  items: XpBreakdownItem[];
};

export function prestigeMultiplier(prestige: number): number {
  return 1 + Math.max(0, prestige) * XP.prestigePerLevel;
}

export function computeSessionXp(
  session: StudySession,
  ctx: SessionXpContext,
): SessionXpResult {
  const items: XpBreakdownItem[] = [];
  const focusMinutes = session.focusMs / 60_000;

  const studyXp = Math.round(focusMinutes * XP.perFocusMinute);
  if (studyXp > 0) {
    items.push({
      key: "study",
      label: `Focus time (${Math.round(focusMinutes)} min)`,
      amount: studyXp,
    });
  }

  if (session.focusedRatio >= XP.focusGoalRatio) {
    items.push({
      key: "focus_goal",
      label: "Focus goal (>80%)",
      amount: XP.focusGoalBonus,
    });
  }

  if (session.averageFocus >= XP.perfectAverage) {
    items.push({
      key: "perfect",
      label: "Perfect session (>95%)",
      amount: XP.perfectSessionBonus,
    });
  }

  if (ctx.isDailyFirst) {
    items.push({
      key: "daily_first",
      label: "Daily first session",
      amount: XP.dailyFirstSessionBonus,
    });
  }

  const base = items.reduce((a, i) => a + i.amount, 0);

  const buddyBonus = ctx.buddyActiveToday
    ? Math.round(base * XP.buddyMultiplier)
    : 0;
  if (buddyBonus > 0) {
    items.push({
      key: "buddy",
      label: "Study buddy bonus (+20%)",
      amount: buddyBonus,
    });
  }

  const subtotal = base + buddyBonus;
  const multiplier = prestigeMultiplier(ctx.prestige);
  const prestigeBonus = Math.round(subtotal * multiplier) - subtotal;
  if (prestigeBonus > 0) {
    items.push({
      key: "prestige",
      label: `Prestige bonus (+${Math.round(ctx.prestige * XP.prestigePerLevel * 100)}%)`,
      amount: prestigeBonus,
    });
  }

  return {
    total: Math.max(0, subtotal + prestigeBonus),
    base,
    buddyBonus,
    prestigeBonus,
    items,
  };
}
