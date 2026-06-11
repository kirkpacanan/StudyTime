import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { MonitoringSnapshotEventType } from "@/lib/types";

export type RoomMonitoringSnapshot = {
  id: string;
  session_id: string;
  user_id: string;
  user_name: string;
  event_type: MonitoringSnapshotEventType;
  session_t_ms: number;
  storage_path: string;
  created_at: string;
  signed_url?: string;
};

export type RoomMemberSessionRow = {
  session_id: string;
  started_at: string;
  ended_at: string;
  average_focus: number;
  focus_ms: number;
  distraction_events: number;
  phone_events: number;
  drift_events: number;
  off_screen_events: number;
};

export async function hasRoomMonitoringConsent(roomId: string): Promise<boolean> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("has_room_monitoring_consent", {
    p_room_id: roomId,
  });
  if (error) {
    if (error.message.includes("has_room_monitoring_consent")) return false;
    throw new Error(error.message);
  }
  return Boolean(data);
}

export async function acceptRoomMonitoringConsent(roomId: string): Promise<void> {
  const sb = getSupabaseBrowser();
  const { error } = await sb.rpc("accept_room_monitoring_consent", {
    p_room_id: roomId,
  });
  if (error) throw new Error(error.message);
}

export async function getRoomMemberSessions(
  roomId: string,
  userId: string,
): Promise<RoomMemberSessionRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("get_library_room_member_sessions", {
    p_room_id: roomId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as RoomMemberSessionRow[];
}

export async function getRoomMonitoringSnapshots(
  roomId: string,
  userId?: string,
): Promise<RoomMonitoringSnapshot[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("get_library_room_snapshots", {
    p_room_id: roomId,
    p_user_id: userId ?? null,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RoomMonitoringSnapshot[];

  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await sb.storage
        .from("session-monitoring")
        .createSignedUrl(row.storage_path, 3600);
      return { ...row, signed_url: signed?.signedUrl };
    }),
  );
  return withUrls;
}

export type PendingMonitoringSnapshot = {
  eventType: MonitoringSnapshotEventType;
  sessionTMs: number;
  blob: Blob;
};

export async function uploadMonitoringSnapshots(
  roomId: string,
  userId: string,
  sessionId: string,
  pending: PendingMonitoringSnapshot[],
): Promise<void> {
  if (pending.length === 0) return;
  const sb = getSupabaseBrowser();

  for (const item of pending) {
    const fileName = `${crypto.randomUUID()}.jpg`;
    const storagePath = `${roomId}/${userId}/${fileName}`;

    const { error: uploadErr } = await sb.storage
      .from("session-monitoring")
      .upload(storagePath, item.blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (uploadErr) {
      console.warn("[monitoring] upload failed:", uploadErr.message);
      continue;
    }

    const { error: insertErr } = await sb.from("session_monitoring_snapshots").insert({
      session_id: sessionId,
      room_id: roomId,
      user_id: userId,
      event_type: item.eventType,
      session_t_ms: item.sessionTMs,
      storage_path: storagePath,
    });
    if (insertErr) {
      console.warn("[monitoring] snapshot row failed:", insertErr.message);
    }
  }
}

/** Focus band for host analytics UI. */
export function focusBand(score: number): "focused" | "mid" | "distracted" {
  if (score >= 70) return "focused";
  if (score >= 50) return "mid";
  return "distracted";
}

export function focusBandLabel(band: ReturnType<typeof focusBand>): string {
  if (band === "focused") return "Focused";
  if (band === "mid") return "Needs attention";
  return "Distracted";
}

export function focusBandClasses(band: ReturnType<typeof focusBand>): {
  text: string;
  bg: string;
  border: string;
} {
  if (band === "focused") {
    return {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/25",
    };
  }
  if (band === "mid") {
    return {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/25",
    };
  }
  return {
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/25",
  };
}

export function snapshotEventLabel(type: MonitoringSnapshotEventType): string {
  switch (type) {
    case "session_start":
      return "Session start";
    case "phone_detected":
      return "Phone detected";
    case "off_screen":
      return "Off screen";
    case "drift":
      return "Drifting";
    default:
      return type;
  }
}
