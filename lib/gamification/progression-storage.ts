/**
 * Progression data layer. Mirrors the dual-mode pattern in `lib/storage.ts`:
 * when Supabase is configured every read/write hits the per-user gamification
 * tables (protected by RLS); otherwise everything is persisted to localStorage
 * so the app still works in demo / offline mode.
 */

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import type { AchievementId } from "./achievements";
import { ACHIEVEMENTS } from "./achievements";
import { STARTER_COSMETIC_IDS } from "./cosmetics";
import {
  DEFAULT_LOADOUT,
  DEFAULT_XP_STATE,
  type BuddyState,
  type ProfileLoadout,
  type UserXpState,
} from "./profile";
import type { Quest, QuestScope } from "./quests";
import { DEFAULT_STREAK, resolveStreakState, type StreakState } from "./streaks";

const KEY = {
  xp: (u: string) => `studytime_xp_${u}`,
  cosmetics: (u: string) => `studytime_cosmetics_${u}`,
  loadout: (u: string) => `studytime_loadout_${u}`,
  streak: (u: string) => `studytime_streak_${u}`,
  quests: (u: string) => `studytime_quests_${u}`,
  buddy: (u: string) => `studytime_buddy_${u}`,
  achievements: (u: string) => `studytime_achievements_${u}`,
};

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function ls(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

// ----------------------------------------------------------------------------
// XP / level / prestige
// ----------------------------------------------------------------------------

export async function getXpState(userId: string): Promise<UserXpState> {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("user_xp")
      .select("xp, level, prestige")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return { ...DEFAULT_XP_STATE };
    return {
      xp: Number(data.xp ?? 0),
      level: Number(data.level ?? 1),
      prestige: Number(data.prestige ?? 0),
    };
  }
  const store = ls();
  return parse<UserXpState>(store?.getItem(KEY.xp(userId)) ?? null, {
    ...DEFAULT_XP_STATE,
  });
}

export async function saveXpState(
  userId: string,
  state: UserXpState,
): Promise<void> {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    await supabase.from("user_xp").upsert(
      {
        user_id: userId,
        xp: state.xp,
        level: state.level,
        prestige: state.prestige,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    return;
  }
  ls()?.setItem(KEY.xp(userId), JSON.stringify(state));
}

/** Append a prestige audit-log entry (Supabase only; best-effort). */
export async function recordPrestige(
  userId: string,
  prestigeLevel: number,
): Promise<void> {
  if (!isSupabaseEnabled()) return;
  const supabase = getSupabaseBrowser();
  await supabase
    .from("prestiges")
    .insert({ user_id: userId, prestige_level: prestigeLevel });
}

// ----------------------------------------------------------------------------
// Owned cosmetics
// ----------------------------------------------------------------------------

export async function getOwnedCosmetics(userId: string): Promise<string[]> {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("user_cosmetics")
      .select("cosmetic_id")
      .eq("user_id", userId);
    const owned = (data ?? []).map((r) => r.cosmetic_id as string);
    return Array.from(new Set([...STARTER_COSMETIC_IDS, ...owned]));
  }
  const store = ls();
  const owned = parse<string[]>(store?.getItem(KEY.cosmetics(userId)) ?? null, []);
  return Array.from(new Set([...STARTER_COSMETIC_IDS, ...owned]));
}

/** Grant cosmetics, skipping ones already owned. Returns the newly granted ids. */
export async function grantCosmetics(
  userId: string,
  ids: string[],
): Promise<string[]> {
  const owned = new Set(await getOwnedCosmetics(userId));
  const toGrant = ids.filter((id) => !owned.has(id));
  if (toGrant.length === 0) return [];

  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    await supabase.from("user_cosmetics").upsert(
      toGrant.map((cosmetic_id) => ({ user_id: userId, cosmetic_id })),
      { onConflict: "user_id,cosmetic_id", ignoreDuplicates: true },
    );
    return toGrant;
  }
  const next = Array.from(new Set([...owned, ...toGrant]));
  ls()?.setItem(KEY.cosmetics(userId), JSON.stringify(next));
  return toGrant;
}

// ----------------------------------------------------------------------------
// Profile loadout
// ----------------------------------------------------------------------------

type LoadoutRow = {
  avatar_id: string | null;
  frame_id: string | null;
  theme_id: string | null;
  title_id: string | null;
  bio: string | null;
  status: string | null;
  pinned_badges: string[] | null;
};

function rowToLoadout(row: LoadoutRow | null): ProfileLoadout {
  if (!row) return { ...DEFAULT_LOADOUT };
  return {
    avatarId: row.avatar_id || DEFAULT_LOADOUT.avatarId,
    frameId: row.frame_id || DEFAULT_LOADOUT.frameId,
    themeId: row.theme_id || DEFAULT_LOADOUT.themeId,
    titleId: row.title_id ?? null,
    bio: row.bio ?? "",
    status: row.status ?? DEFAULT_LOADOUT.status,
    pinnedBadges: (row.pinned_badges ?? []) as AchievementId[],
  };
}

export async function getLoadout(userId: string): Promise<ProfileLoadout> {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("user_profiles")
      .select("avatar_id, frame_id, theme_id, title_id, bio, status, pinned_badges")
      .eq("user_id", userId)
      .maybeSingle();
    return rowToLoadout(data as LoadoutRow | null);
  }
  const store = ls();
  return parse<ProfileLoadout>(store?.getItem(KEY.loadout(userId)) ?? null, {
    ...DEFAULT_LOADOUT,
  });
}

export async function saveLoadout(
  userId: string,
  loadout: ProfileLoadout,
): Promise<void> {
  const clean: ProfileLoadout = {
    ...loadout,
    pinnedBadges: loadout.pinnedBadges.slice(0, 3),
  };
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    await supabase.from("user_profiles").upsert(
      {
        user_id: userId,
        avatar_id: clean.avatarId,
        frame_id: clean.frameId,
        theme_id: clean.themeId,
        title_id: clean.titleId,
        bio: clean.bio,
        status: clean.status,
        pinned_badges: clean.pinnedBadges,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    return;
  }
  ls()?.setItem(KEY.loadout(userId), JSON.stringify(clean));
}

// ----------------------------------------------------------------------------
// Achievements
// ----------------------------------------------------------------------------

export async function getUnlockedAchievementIds(
  userId: string,
): Promise<AchievementId[]> {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", userId)
      .not("unlocked_at", "is", null);
    return (data ?? [])
      .map((r) => r.achievement_id as AchievementId)
      .filter((id) => id in ACHIEVEMENTS);
  }
  const store = ls();
  return parse<AchievementId[]>(
    store?.getItem(KEY.achievements(userId)) ?? null,
    [],
  ).filter((id) => id in ACHIEVEMENTS);
}

/** Persist union(previous, ids). Returns the newly unlocked ids. */
export async function grantAchievements(
  userId: string,
  ids: AchievementId[],
): Promise<AchievementId[]> {
  const before = new Set(await getUnlockedAchievementIds(userId));
  const fresh = ids.filter((id) => !before.has(id));
  if (fresh.length === 0) return [];

  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    const now = new Date().toISOString();
    await supabase.from("user_achievements").upsert(
      fresh.map((achievement_id) => ({
        user_id: userId,
        achievement_id,
        progress: 100,
        unlocked_at: now,
      })),
      { onConflict: "user_id,achievement_id", ignoreDuplicates: true },
    );
    return fresh;
  }
  const next = Array.from(new Set([...before, ...fresh]));
  ls()?.setItem(KEY.achievements(userId), JSON.stringify(next));
  return fresh;
}

// ----------------------------------------------------------------------------
// Streak
// ----------------------------------------------------------------------------

export async function getStreakState(userId: string): Promise<StreakState> {
  let raw: StreakState;
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("streaks")
      .select("current_streak, longest_streak, last_study_date, freeze_tokens, claimed_milestones")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return { ...DEFAULT_STREAK };
    raw = {
      current: Number(data.current_streak ?? 0),
      longest: Number(data.longest_streak ?? 0),
      lastStudyDate: (data.last_study_date as string | null) ?? null,
      freezeTokens: Number(data.freeze_tokens ?? 0),
      claimedMilestones: (data.claimed_milestones ?? []) as number[],
    };
  } else {
    const store = ls();
    raw = parse<StreakState>(store?.getItem(KEY.streak(userId)) ?? null, {
      ...DEFAULT_STREAK,
    });
  }

  const resolved = resolveStreakState(raw);
  if (resolved.current !== raw.current) {
    await saveStreakState(userId, resolved);
  }
  return resolved;
}

export async function saveStreakState(
  userId: string,
  state: StreakState,
): Promise<void> {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    await supabase.from("streaks").upsert(
      {
        user_id: userId,
        current_streak: state.current,
        longest_streak: state.longest,
        last_study_date: state.lastStudyDate,
        freeze_tokens: state.freezeTokens,
        claimed_milestones: state.claimedMilestones,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    return;
  }
  ls()?.setItem(KEY.streak(userId), JSON.stringify(state));
}

// ----------------------------------------------------------------------------
// Quests
// ----------------------------------------------------------------------------

type QuestRow = {
  id: string;
  scope: string;
  period_key: string;
  template_id: string;
  title: string;
  metric: string;
  target: number;
  progress: number;
  reward_xp: number;
  completed: boolean;
};

function rowToQuest(r: QuestRow): Quest {
  return {
    id: r.id,
    templateId: r.template_id,
    scope: r.scope as QuestScope,
    periodKey: r.period_key,
    title: r.title,
    metric: r.metric as Quest["metric"],
    target: r.target,
    progress: r.progress,
    rewardXp: r.reward_xp,
    completed: r.completed,
  };
}

export async function getQuestsForPeriod(
  userId: string,
  scope: QuestScope,
  periodKey: string,
): Promise<Quest[]> {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("daily_quests")
      .select("id, scope, period_key, template_id, title, metric, target, progress, reward_xp, completed")
      .eq("user_id", userId)
      .eq("scope", scope)
      .eq("period_key", periodKey);
    return (data ?? []).map((r) => rowToQuest(r as QuestRow));
  }
  const store = ls();
  const all = parse<Quest[]>(store?.getItem(KEY.quests(userId)) ?? null, []);
  return all.filter((q) => q.scope === scope && q.periodKey === periodKey);
}

/** Create quests for a period if none exist yet; returns the active set. */
export async function ensureQuests(
  userId: string,
  scope: QuestScope,
  periodKey: string,
  generate: () => Quest[],
): Promise<Quest[]> {
  const existing = await getQuestsForPeriod(userId, scope, periodKey);
  if (existing.length > 0) return existing;
  const generated = generate();
  await saveQuests(userId, generated);
  return generated;
}

export async function saveQuests(
  userId: string,
  quests: Quest[],
): Promise<void> {
  if (quests.length === 0) return;
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    await supabase.from("daily_quests").upsert(
      quests.map((q) => ({
        id: q.id,
        user_id: userId,
        scope: q.scope,
        period_key: q.periodKey,
        template_id: q.templateId,
        title: q.title,
        metric: q.metric,
        target: q.target,
        progress: q.progress,
        reward_xp: q.rewardXp,
        completed: q.completed,
      })),
      { onConflict: "id" },
    );
    return;
  }
  const store = ls();
  const all = parse<Quest[]>(store?.getItem(KEY.quests(userId)) ?? null, []);
  const byId = new Map(all.map((q) => [q.id, q]));
  for (const q of quests) byId.set(q.id, q);
  store?.setItem(KEY.quests(userId), JSON.stringify(Array.from(byId.values())));
}

// ----------------------------------------------------------------------------
// Study buddy
// ----------------------------------------------------------------------------

export async function getBuddy(userId: string): Promise<BuddyState | null> {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.rpc("get_study_buddy");
    if (error || !data) return null;
    const d = data as Record<string, unknown>;
    return {
      buddyId: String(d.buddyId),
      buddyName: String(d.displayName ?? "Study buddy"),
      username: (d.username as string | null) ?? null,
      publicUid: String(d.publicUid ?? ""),
      avatarId: (d.avatarId as string | null) ?? null,
      frameId: (d.frameId as string | null) ?? null,
      level: Number(d.level ?? 1),
      prestige: Number(d.prestige ?? 0),
      currentStreak: Number(d.currentStreak ?? 0),
      pairedSince: (d.pairedSince as string | null) ?? null,
      status: (d.status as BuddyState["status"]) ?? "active",
    };
  }
  const store = ls();
  return parse<BuddyState | null>(store?.getItem(KEY.buddy(userId)) ?? null, null);
}

export async function pairBuddy(
  userId: string,
  buddyId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (userId === buddyId) {
    return { ok: false, error: "You can't pair with yourself." };
  }
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.rpc("pair_study_buddy", { p_buddy: buddyId });
    if (error) {
      return { ok: false, error: humanizeBuddyError(error.message) };
    }
    return { ok: true };
  }
  ls()?.setItem(
    KEY.buddy(userId),
    JSON.stringify({
      buddyId,
      buddyName: "Study buddy",
      username: null,
      publicUid: "",
      avatarId: null,
      frameId: null,
      level: 1,
      prestige: 0,
      currentStreak: 0,
      pairedSince: new Date().toISOString(),
      status: "active",
    }),
  );
  return { ok: true };
}

/**
 * Did the buddy complete a session today? Uses a SECURITY DEFINER RPC because
 * RLS prevents reading another user's sessions directly. In local/demo mode
 * we optimistically return true when a buddy is paired.
 */
export async function buddyStudiedToday(buddyId: string): Promise<boolean> {
  if (!isSupabaseEnabled()) return true;
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.rpc("buddy_studied_today", {
    p_buddy: buddyId,
  });
  if (error) return false;
  return data === true;
}

export async function unpairBuddy(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.rpc("unpair_study_buddy");
    if (error) {
      return { ok: false, error: humanizeBuddyError(error.message) };
    }
    return { ok: true };
  }
  ls()?.removeItem(KEY.buddy(userId));
  return { ok: true };
}

function humanizeBuddyError(message: string): string {
  return message.replace(/^.*?:\s*/, "").trim() || "Something went wrong.";
}
