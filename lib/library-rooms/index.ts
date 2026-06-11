/**
 * Library rooms — thin wrapper around Focus Hub room backend for private 3D libraries.
 */
import { getSupabaseBrowser } from "@/lib/supabase/client";

export type {
  FocusHubRoom as LibraryRoom,
  RoomWithRole as LibraryRoomWithRole,
  CreateRoomInput as CreateLibraryRoomInput,
  RoomRole as LibraryRoomRole,
} from "@/lib/focus-hub/types";

export type LibraryRoomAnalyticsRow = {
  user_id: string;
  user_name: string;
  session_count: number;
  avg_focus: number;
  total_focus_ms: number;
  low_focus_count: number;
  phone_events: number;
  drift_events: number;
  off_screen_events: number;
  last_session_at: string | null;
};

export type { PublicLibraryRoomRow as PublicLibraryRoom } from "@/lib/focus-hub/client";

export {
  getMyRooms as getMyLibraryRooms,
  getRoomById as getLibraryRoomById,
  getRoomRole as getLibraryRoomRole,
  createRoom as createLibraryRoom,
  joinRoom as joinLibraryRoom,
  getPublicRooms as getPublicLibraryRooms,
  joinPublicRoom as joinPublicLibraryRoom,
  archiveRoom as archiveLibraryRoom,
  getRoomMembers as getLibraryRoomMembers,
  removeParticipant as removeLibraryRoomParticipant,
  leaveRoom as leaveLibraryRoom,
} from "@/lib/focus-hub/client";

export async function getLibraryRoomAnalytics(
  roomId: string,
): Promise<LibraryRoomAnalyticsRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("get_library_room_analytics", {
    p_room_id: roomId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryRoomAnalyticsRow[];
}

export async function getLibraryRoomPresence(roomId: string) {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("get_room_presence", {
    p_room_id: roomId,
  });
  if (error) return [];
  return (data ?? []) as Array<{
    user_id: string;
    seat_id: string;
    avatar_url: string | null;
    status: string;
    focus_phase: string | null;
    last_seen_at: string;
  }>;
}
