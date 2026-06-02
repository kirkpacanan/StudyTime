/**
 * Profile + search service. Wraps the SECURITY DEFINER RPCs that expose
 * cross-user data with an explicit column allowlist. All functions require
 * Supabase to be configured; callers should gate social UI behind
 * `isSupabaseEnabled()`.
 */

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import {
  DEFAULT_PRIVACY,
  type MyProfile,
  type PublicProfileCard,
  type PrivacySettings,
  type UserSearchResult,
} from "./types";

export class SocialUnavailableError extends Error {
  constructor() {
    super("Social features require a cloud (Supabase) account.");
    this.name = "SocialUnavailableError";
  }
}

function ensureCloud() {
  if (!isSupabaseEnabled()) throw new SocialUnavailableError();
  return getSupabaseBrowser();
}

export async function getMyProfile(): Promise<MyProfile | null> {
  const supabase = ensureCloud();
  const { data, error } = await supabase.rpc("get_my_profile");
  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  const privacy = (d.privacy as Partial<PrivacySettings>) ?? {};
  return {
    userId: String(d.userId),
    email: String(d.email ?? ""),
    username: (d.username as string | null) ?? null,
    publicUid: String(d.publicUid ?? ""),
    displayName: String(d.displayName ?? "Student"),
    memberSince: String(d.memberSince ?? new Date().toISOString()),
    privacy: { ...DEFAULT_PRIVACY, ...privacy },
  };
}

export async function updateProfile(input: {
  displayName?: string;
  username?: string;
}): Promise<{ ok: true; profile: MyProfile } | { ok: false; error: string }> {
  const supabase = ensureCloud();
  const { data, error } = await supabase.rpc("update_profile", {
    p_display_name: input.displayName ?? null,
    p_username: input.username ?? null,
  });
  if (error) return { ok: false, error: humanize(error.message) };
  const profile = await coerceMyProfile(data);
  return profile
    ? { ok: true, profile }
    : { ok: false, error: "Could not update profile." };
}

export async function updatePrivacySettings(
  settings: Partial<PrivacySettings>,
): Promise<{ ok: true; profile: MyProfile } | { ok: false; error: string }> {
  const supabase = ensureCloud();
  const { data, error } = await supabase.rpc("update_privacy_settings", {
    p_settings: settings,
  });
  if (error) return { ok: false, error: humanize(error.message) };
  const profile = await coerceMyProfile(data);
  return profile
    ? { ok: true, profile }
    : { ok: false, error: "Could not update settings." };
}

/** Resolve a public profile by id, username, or public UID. */
export async function getPublicProfile(handle: {
  userId?: string;
  username?: string;
  publicUid?: string;
}): Promise<PublicProfileCard | null> {
  const supabase = ensureCloud();
  const { data, error } = await supabase.rpc("get_public_profile", {
    p_target: handle.userId ?? null,
    p_username: handle.username ?? null,
    p_public_uid: handle.publicUid ?? null,
  });
  if (error || !data) return null;
  return mapCard(data as Record<string, unknown>);
}

export async function searchUsers(
  query: string,
  limit = 20,
): Promise<UserSearchResult[]> {
  const supabase = ensureCloud();
  const term = query.trim();
  if (term.length < 2) return [];
  const { data, error } = await supabase.rpc("search_users", {
    p_query: term,
    p_limit: limit,
  });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    userId: String(r.user_id),
    username: (r.username as string | null) ?? null,
    publicUid: String(r.public_uid ?? ""),
    displayName: String(r.display_name ?? "Student"),
    avatarId: (r.avatar_id as string | null) ?? null,
    frameId: (r.frame_id as string | null) ?? null,
    level: Number(r.level ?? 1),
  }));
}

async function coerceMyProfile(data: unknown): Promise<MyProfile | null> {
  if (!data) return null;
  const d = data as Record<string, unknown>;
  const privacy = (d.privacy as Partial<PrivacySettings>) ?? {};
  return {
    userId: String(d.userId),
    email: String(d.email ?? ""),
    username: (d.username as string | null) ?? null,
    publicUid: String(d.publicUid ?? ""),
    displayName: String(d.displayName ?? "Student"),
    memberSince: String(d.memberSince ?? new Date().toISOString()),
    privacy: { ...DEFAULT_PRIVACY, ...privacy },
  };
}

function mapCard(d: Record<string, unknown>): PublicProfileCard {
  const loadout = (d.loadout as Record<string, unknown>) ?? {};
  const stats = d.stats as Record<string, unknown> | null;
  return {
    userId: String(d.userId),
    username: (d.username as string | null) ?? null,
    publicUid: String(d.publicUid ?? ""),
    displayName: String(d.displayName ?? "Student"),
    memberSince: String(d.memberSince ?? new Date().toISOString()),
    profileVisibility:
      (d.profileVisibility as PublicProfileCard["profileVisibility"]) ??
      "friends",
    allowFriendRequests: Boolean(d.allowFriendRequests ?? true),
    loadout: {
      avatarId: String(loadout.avatarId ?? "avatar_starter"),
      frameId: String(loadout.frameId ?? "frame_none"),
      themeId: String(loadout.themeId ?? "theme_default"),
      titleId: (loadout.titleId as string | null) ?? null,
      bio: String(loadout.bio ?? ""),
      status: String(loadout.status ?? ""),
      pinnedBadges: (loadout.pinnedBadges as string[] | null) ?? [],
    },
    level: Number(d.level ?? 1),
    prestige: Number(d.prestige ?? 0),
    xp: Number(d.xp ?? 0),
    relationship:
      (d.relationship as PublicProfileCard["relationship"]) ?? "none",
    visible: Boolean(d.visible),
    stats: stats
      ? {
          currentStreak: Number(stats.currentStreak ?? 0),
          longestStreak: Number(stats.longestStreak ?? 0),
          totalFocusHours: Number(stats.totalFocusHours ?? 0),
          sessionsCount: Number(stats.sessionsCount ?? 0),
        }
      : null,
  };
}

/** Strip Postgres prefixes from RAISE EXCEPTION messages. */
function humanize(message: string): string {
  return message.replace(/^.*?:\s*/, "").trim() || "Something went wrong.";
}
