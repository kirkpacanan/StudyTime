/**
 * Presence service: heartbeat upserts + friends' presence reads. Realtime
 * subscription helpers live in `contexts/presence-context.tsx`.
 */

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import type { PresenceStatus } from "./types";

export async function heartbeat(
  status: PresenceStatus,
  opts: {
    sessionId?: string | null;
    focusPhase?: string | null;
    seatId?: string | null;
    avatarUrl?: string | null;
    roomId?: string | null;
  } = {},
): Promise<void> {
  if (!isSupabaseEnabled()) return;
  try {
    const supabase = getSupabaseBrowser();
    await supabase.rpc("heartbeat_presence", {
      p_status: status,
      p_session_id: opts.sessionId ?? null,
      p_focus_phase: opts.focusPhase ?? null,
      p_seat_id: opts.seatId ?? null,
      p_avatar_url: opts.avatarUrl ?? null,
      p_room_id: opts.roomId ?? "main",
    });
  } catch {
    /* presence is best-effort */
  }
}

export type FriendPresence = {
  userId: string;
  status: PresenceStatus;
  focusPhase: string | null;
  lastSeenAt: string;
};

export async function getFriendsPresence(): Promise<FriendPresence[]> {
  if (!isSupabaseEnabled()) return [];
  try {
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.rpc("get_friends_presence");
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      userId: String(r.user_id),
      status: (r.status as PresenceStatus) ?? "offline",
      focusPhase: (r.focus_phase as string | null) ?? null,
      lastSeenAt: String(r.last_seen_at ?? new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}
