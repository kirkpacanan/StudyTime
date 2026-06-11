import { getSupabaseBrowser } from "@/lib/supabase/client";
import type {
  CreateActivityInput,
  CreateRoomInput,
  FocusHubActivity,
  FocusHubRoom,
  FocusHubSession,
  FocusHubSamplePoint,
  RoomAnalyticsRow,
  RoomWithRole,
} from "./types";

// ── Rooms ─────────────────────────────────────────────────────────────────────

export async function getMyRooms(): Promise<RoomWithRole[]> {
  const sb = getSupabaseBrowser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const { data, error } = await sb
    .from("focus_hub_memberships")
    .select(`
      role,
      room:focus_hub_rooms (*)
    `)
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Array<{
    role: "host" | "participant";
    room: FocusHubRoom | null;
  }>;

  const byRoom = new Map<string, RoomWithRole>();
  for (const row of rows) {
    if (!row.room?.id || row.room.archived_at) continue;
    const existing = byRoom.get(row.room.id);
    if (!existing || (row.role === "host" && existing.role !== "host")) {
      byRoom.set(row.room.id, {
        ...row.room,
        role: row.role,
        memberCount: 0,
      });
    }
  }

  const rooms = [...byRoom.values()];
  if (rooms.length === 0) return [];

  const roomIds = rooms.map((r) => r.id);
  const { data: counts } = await sb
    .from("focus_hub_memberships")
    .select("room_id")
    .in("room_id", roomIds);

  const countMap: Record<string, number> = {};
  for (const c of counts ?? []) {
    countMap[c.room_id] = (countMap[c.room_id] ?? 0) + 1;
  }

  return rooms.map((r) => ({
    ...r,
    memberCount: countMap[r.id] ?? 0,
  }));
}

export async function getRoomById(roomId: string): Promise<FocusHubRoom | null> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("focus_hub_rooms")
    .select("*")
    .eq("id", roomId)
    .single();
  if (error) return null;
  return data as FocusHubRoom;
}

export async function getRoomRole(roomId: string): Promise<"host" | "participant" | null> {
  const sb = getSupabaseBrowser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("focus_hub_memberships")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single();
  return (data?.role as "host" | "participant") ?? null;
}

export async function createRoom(input: CreateRoomInput): Promise<FocusHubRoom> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("create_focus_hub_room", {
    p_name: input.name,
    p_description: input.description ?? null,
    p_category: input.category ?? null,
    p_participant_limit: input.participant_limit ?? 50,
    p_is_private: input.is_private ?? false,
  });
  if (error) throw new Error(error.message);
  return data as FocusHubRoom;
}

export async function joinRoom(joinCode: string): Promise<FocusHubRoom> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("join_focus_hub_room", {
    p_join_code: joinCode.toUpperCase().trim(),
  });
  if (error) throw new Error(error.message);
  return data as FocusHubRoom;
}

export type PublicLibraryRoomRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  participant_limit: number;
  member_count: number;
  created_at: string;
};

function isMissingRpcError(message: string, rpcName: string): boolean {
  return (
    message.includes(rpcName) ||
    message.includes("schema cache") ||
    message.includes("PGRST202")
  );
}

export async function getPublicRooms(): Promise<PublicLibraryRoomRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("list_public_library_rooms");
  if (error) {
    if (isMissingRpcError(error.message, "list_public_library_rooms")) {
      console.warn("[library-rooms] list_public_library_rooms not available:", error.message);
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as PublicLibraryRoomRow[];
}

export async function joinPublicRoom(roomId: string): Promise<FocusHubRoom> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("join_public_library_room", {
    p_room_id: roomId,
  });
  if (error) {
    if (isMissingRpcError(error.message, "join_public_library_room")) {
      throw new Error(
        "Public room join is not available yet. Apply the latest database migration and refresh.",
      );
    }
    throw new Error(error.message);
  }
  return data as FocusHubRoom;
}

export async function archiveRoom(roomId: string): Promise<void> {
  const sb = getSupabaseBrowser();
  const { error } = await sb
    .from("focus_hub_rooms")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", roomId);
  if (error) throw new Error(error.message);
}

export async function getRoomMembers(roomId: string) {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("get_focus_hub_room_members", {
    p_room_id: roomId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    user_id: string;
    role: "host" | "participant";
    joined_at: string;
    name: string;
    avatar_url: string | null;
  }>;
}

export async function removeParticipant(roomId: string, userId: string): Promise<void> {
  const sb = getSupabaseBrowser();
  const { error } = await sb
    .from("focus_hub_memberships")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function leaveRoom(roomId: string): Promise<void> {
  const sb = getSupabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await removeParticipant(roomId, user.id);
}

// ── Activities ────────────────────────────────────────────────────────────────

export async function getRoomActivities(roomId: string): Promise<FocusHubActivity[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("focus_hub_activities")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FocusHubActivity[];
}

export async function getActivity(activityId: string): Promise<FocusHubActivity | null> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("focus_hub_activities")
    .select("*")
    .eq("id", activityId)
    .single();
  if (error) return null;
  return data as FocusHubActivity;
}

export async function createActivity(input: CreateActivityInput): Promise<FocusHubActivity> {
  const sb = getSupabaseBrowser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Not authenticated.");
  const { data, error } = await sb
    .from("focus_hub_activities")
    .insert({
      room_id: input.room_id,
      created_by: user.id,
      title: input.title,
      description: input.description ?? null,
      instructions: input.instructions ?? null,
      activity_type: input.activity_type,
      due_at: input.due_at ?? null,
      duration_minutes: input.duration_minutes ?? null,
      focus_required: input.focus_required ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as FocusHubActivity;
}

export async function startActivity(activityId: string): Promise<FocusHubActivity> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("start_focus_hub_activity", {
    p_activity_id: activityId,
  });
  if (error) throw new Error(error.message);
  return data as FocusHubActivity;
}

export async function endActivity(activityId: string): Promise<FocusHubActivity> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("end_focus_hub_activity", {
    p_activity_id: activityId,
  });
  if (error) throw new Error(error.message);
  return data as FocusHubActivity;
}

// ── Focus sessions ────────────────────────────────────────────────────────────

export async function upsertFocusSession(
  activityId: string,
  samples: FocusHubSamplePoint[],
  averageFocus: number,
): Promise<void> {
  const sb = getSupabaseBrowser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { error } = await sb
    .from("focus_hub_sessions")
    .upsert(
      {
        activity_id: activityId,
        user_id: user.id,
        samples,
        average_focus: Math.round(averageFocus),
      },
      { onConflict: "activity_id,user_id" },
    );
  if (error) console.error("focus-hub upsertSession:", error.message);
}

export async function submitSession(activityId: string): Promise<void> {
  const sb = getSupabaseBrowser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { error } = await sb
    .from("focus_hub_sessions")
    .update({ submitted: true, ended_at: new Date().toISOString() })
    .eq("activity_id", activityId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function getActivitySessions(activityId: string): Promise<FocusHubSession[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("focus_hub_sessions")
    .select("*")
    .eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  return (data ?? []) as FocusHubSession[];
}

export async function flagSession(activityId: string, userId: string): Promise<void> {
  const sb = getSupabaseBrowser();
  const { error } = await sb
    .from("focus_hub_sessions")
    .update({ flagged: true })
    .eq("activity_id", activityId)
    .eq("user_id", userId);
  if (error) console.error("focus-hub flagSession:", error.message);
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getRoomAnalytics(roomId: string): Promise<RoomAnalyticsRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("get_focus_hub_room_analytics", {
    p_room_id: roomId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as RoomAnalyticsRow[];
}

export async function getRecentRoomActivities(): Promise<
  Array<{ activity: FocusHubActivity; room: FocusHubRoom }>
> {
  const sb = getSupabaseBrowser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const { data, error } = await sb
    .from("focus_hub_sessions")
    .select(`
      activity:focus_hub_activities (
        *,
        room:focus_hub_rooms (*)
      )
    `)
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(8);

  if (error) return [];

  return ((data ?? []) as unknown as Array<{ activity: { room: FocusHubRoom } & FocusHubActivity }>)
    .map((row) => ({
      activity: row.activity,
      room: row.activity.room,
    }))
    .filter((r) => r.room != null);
}
