/**
 * Shared types + defaults for a player's progression state: their cosmetic
 * loadout, XP/level/prestige, and the derived "profile snapshot" used by the
 * sidebar panel, customizer, leaderboard and buddy cards.
 */

import type { AchievementId } from "./achievements";
import {
  DEFAULT_AVATAR_ID,
  DEFAULT_FRAME_ID,
  DEFAULT_THEME_ID,
} from "./cosmetics";

export type UserXpState = {
  xp: number;
  level: number;
  prestige: number;
};

export const DEFAULT_XP_STATE: UserXpState = { xp: 0, level: 1, prestige: 0 };

export type ProfileLoadout = {
  avatarId: string;
  frameId: string;
  themeId: string;
  /** Equipped title slug (rank slug or special). null = use current rank. */
  titleId: string | null;
  bio: string;
  status: string;
  /** Up to 3 pinned achievement (badge) ids. */
  pinnedBadges: AchievementId[];
};

export const DEFAULT_LOADOUT: ProfileLoadout = {
  avatarId: DEFAULT_AVATAR_ID,
  frameId: DEFAULT_FRAME_ID,
  themeId: DEFAULT_THEME_ID,
  titleId: null,
  bio: "",
  status: "Locked in",
  pinnedBadges: [],
};

export type BuddyState = {
  buddyId: string;
  buddyName: string;
  status: "pending" | "active" | "ended";
};
