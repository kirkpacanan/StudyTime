/**
 * Friends service: send/respond/remove/block plus friends + requests lists.
 * All writes go through SECURITY DEFINER RPCs so RLS stays read-only.
 */

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import {
  SocialUnavailableError,
} from "./profile-service";
import type { Friend, FriendRequest, PresenceStatus } from "./types";

function ensureCloud() {
  if (!isSupabaseEnabled()) throw new SocialUnavailableError();
  return getSupabaseBrowser();
}

function humanize(message: string): string {
  return message.replace(/^.*?:\s*/, "").trim() || "Something went wrong.";
}

export async function sendFriendRequest(
  targetUserId: string,
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const supabase = ensureCloud();
  const { data, error } = await supabase.rpc("send_friend_request", {
    p_target: targetUserId,
  });
  if (error) return { ok: false, error: humanize(error.message) };
  return { ok: true, status: String((data as { status?: string })?.status ?? "pending") };
}

export async function respondFriendRequest(
  requestId: string,
  accept: boolean,
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const supabase = ensureCloud();
  const { data, error } = await supabase.rpc("respond_friend_request", {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) return { ok: false, error: humanize(error.message) };
  return { ok: true, status: String((data as { status?: string })?.status ?? "") };
}

export async function removeFriend(
  friendUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = ensureCloud();
  const { error } = await supabase.rpc("remove_friend", { p_friend: friendUserId });
  if (error) return { ok: false, error: humanize(error.message) };
  return { ok: true };
}

export async function blockUser(
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = ensureCloud();
  const { error } = await supabase.rpc("block_user", { p_target: targetUserId });
  if (error) return { ok: false, error: humanize(error.message) };
  return { ok: true };
}

export async function cancelFriendRequest(
  requestId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = ensureCloud();
  const { error } = await supabase.rpc("cancel_friend_request", {
    p_request_id: requestId,
  });
  if (error) return { ok: false, error: humanize(error.message) };
  return { ok: true };
}

export async function listFriends(): Promise<Friend[]> {
  const supabase = ensureCloud();
  const { data, error } = await supabase.rpc("list_friends");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    userId: String(r.user_id),
    username: (r.username as string | null) ?? null,
    publicUid: String(r.public_uid ?? ""),
    displayName: String(r.display_name ?? "Student"),
    avatarId: (r.avatar_id as string | null) ?? null,
    frameId: (r.frame_id as string | null) ?? null,
    level: Number(r.level ?? 1),
    currentStreak: Number(r.current_streak ?? 0),
    presenceStatus: (r.presence_status as PresenceStatus) ?? "offline",
    lastSeenAt: (r.last_seen_at as string | null) ?? null,
    friendsSince: String(r.friends_since ?? new Date().toISOString()),
  }));
}

export async function listFriendRequests(
  inbox: boolean,
): Promise<FriendRequest[]> {
  const supabase = ensureCloud();
  const { data, error } = await supabase.rpc("list_friend_requests", {
    p_inbox: inbox,
  });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    requestId: String(r.request_id),
    userId: String(r.user_id),
    username: (r.username as string | null) ?? null,
    publicUid: String(r.public_uid ?? ""),
    displayName: String(r.display_name ?? "Student"),
    avatarId: (r.avatar_id as string | null) ?? null,
    frameId: (r.frame_id as string | null) ?? null,
    level: Number(r.level ?? 1),
    createdAt: String(r.created_at ?? new Date().toISOString()),
  }));
}
