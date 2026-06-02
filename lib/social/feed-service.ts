/**
 * Activity feed + notifications service. `emitActivity` is best-effort and
 * safe to call from the client; the server enforces actor = auth.uid().
 */

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import type {
  ActivityEvent,
  ActivityVerb,
  AppNotification,
} from "./types";

export async function emitActivity(
  verb: ActivityVerb,
  opts: {
    objectType?: string | null;
    objectId?: string | null;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  if (!isSupabaseEnabled()) return;
  try {
    const supabase = getSupabaseBrowser();
    await supabase.rpc("emit_activity_event", {
      p_verb: verb,
      p_object_type: opts.objectType ?? null,
      p_object_id: opts.objectId ?? null,
      p_metadata: opts.metadata ?? {},
    });
  } catch {
    /* feed writes are best-effort */
  }
}

export async function getActivityFeed(
  before: string | null = null,
  limit = 30,
): Promise<ActivityEvent[]> {
  if (!isSupabaseEnabled()) return [];
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.rpc("get_activity_feed", {
    p_before: before,
    p_limit: limit,
  });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    actorId: String(r.actor_id),
    username: (r.username as string | null) ?? null,
    publicUid: String(r.public_uid ?? ""),
    displayName: String(r.display_name ?? "Student"),
    avatarId: (r.avatar_id as string | null) ?? null,
    frameId: (r.frame_id as string | null) ?? null,
    verb: r.verb as ActivityVerb,
    objectType: (r.object_type as string | null) ?? null,
    objectId: (r.object_id as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: String(r.created_at ?? new Date().toISOString()),
  }));
}

export async function getNotifications(
  limit = 20,
): Promise<AppNotification[]> {
  if (!isSupabaseEnabled()) return [];
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, payload, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    id: String(r.id),
    type: String(r.type),
    payload: (r.payload as Record<string, unknown>) ?? {},
    readAt: (r.read_at as string | null) ?? null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
  }));
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  if (!isSupabaseEnabled()) return;
  const supabase = getSupabaseBrowser();
  await supabase.rpc("mark_notifications_read", {
    p_ids: ids && ids.length ? ids : null,
  });
}
