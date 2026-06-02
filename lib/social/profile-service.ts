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

/** Thrown when social RPCs/tables are missing on the Supabase project. */
export class SocialSetupError extends Error {
  constructor(context: string) {
    super(
      `Social database is not set up (${context}). Apply supabase/APPLY_SOCIAL.sql in the Supabase SQL editor, or run: npx supabase db push`,
    );
    this.name = "SocialSetupError";
  }
}

function isMissingRpc(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /Could not find the function/i.test(error.message ?? "") ||
    /function .* does not exist/i.test(error.message ?? "")
  );
}

function rpcError(error: { message?: string; code?: string }, context: string): string {
  if (isMissingRpc(error)) {
    return new SocialSetupError(context).message;
  }
  return humanize(error.message ?? "Something went wrong.");
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
    friendCount: Number(d.friendCount ?? 0),
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
}): Promise<{ profile: PublicProfileCard | null; error: string | null }> {
  const supabase = ensureCloud();
  const { data, error } = await supabase.rpc("get_public_profile", {
    p_target: handle.userId ?? null,
    p_username: handle.username ?? null,
    p_public_uid: handle.publicUid ?? null,
  });
  if (error) return { profile: null, error: rpcError(error, "get_public_profile") };
  if (!data) return { profile: null, error: null };
  return { profile: mapCard(data as Record<string, unknown>), error: null };
}

export async function searchUsers(
  query: string,
  limit = 20,
): Promise<{ results: UserSearchResult[]; error: string | null }> {
  const supabase = ensureCloud();
  const term = query.trim();
  if (term.length < 2) return { results: [], error: null };
  const { data, error } = await supabase.rpc("search_users", {
    p_query: term,
    p_limit: limit,
  });
  if (error) return { results: [], error: rpcError(error, "search_users") };
  if (!data) return { results: [], error: null };
  return {
    results: (data as Record<string, unknown>[]).map((r) => ({
      userId: String(r.user_id),
      username: (r.username as string | null) ?? null,
      publicUid: String(r.public_uid ?? ""),
      displayName: String(r.display_name ?? "Student"),
      avatarId: (r.avatar_id as string | null) ?? null,
      frameId: (r.frame_id as string | null) ?? null,
      level: Number(r.level ?? 1),
      relationship:
        (r.relationship as UserSearchResult["relationship"]) ?? "none",
    })),
    error: null,
  };
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
    friendCount: Number(d.friendCount ?? 0),
    privacy: { ...DEFAULT_PRIVACY, ...privacy },
  };
}

function mapStudyBuddy(raw: unknown): PublicProfileCard["studyBuddy"] {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  return {
    buddyId: String(b.buddyId),
    username: (b.username as string | null) ?? null,
    publicUid: String(b.publicUid ?? ""),
    displayName: String(b.displayName ?? "Study buddy"),
    avatarId: (b.avatarId as string | null) ?? null,
    frameId: (b.frameId as string | null) ?? null,
    level: Number(b.level ?? 1),
    pairedSince: String(b.pairedSince ?? new Date().toISOString()),
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
    friendCount: Number(d.friendCount ?? 0),
    studyBuddy: mapStudyBuddy(d.studyBuddy),
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
