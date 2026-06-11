import { evidenceEventDescription, evidenceEventLabel } from "@/lib/monitoring/event-labels";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { EvidenceEventType } from "@/lib/types";

export type RoomMonitoringSnapshot = {
  id: string;
  session_id: string;
  user_id: string;
  user_name: string;
  event_type: EvidenceEventType;
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
  activity_id?: string | null;
};

export type ActivityEventLogRow = {
  id: string;
  session_id: string;
  user_id: string;
  user_name: string;
  event_index: number;
  event_type: string;
  event_description: string | null;
  duration_ms: number | null;
  occurred_at: string;
  session_t_ms: number;
  webcam_storage_path: string | null;
  screen_storage_path: string | null;
  webcam_signed_url?: string;
  screen_signed_url?: string;
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

export async function acceptRoomMonitoringConsent(
  roomId: string,
  screenConsent = false,
): Promise<void> {
  const sb = getSupabaseBrowser();
  const { error } = await sb.rpc("accept_room_monitoring_consent", {
    p_room_id: roomId,
    p_screen_consent: screenConsent,
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

export async function getRoomActivityEventLog(
  roomId: string,
  userId: string,
  sessionId?: string | null,
): Promise<ActivityEventLogRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("get_room_activity_event_log", {
    p_room_id: roomId,
    p_user_id: userId,
    p_session_id: sessionId ?? null,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ActivityEventLogRow[];

  return Promise.all(
    rows.map(async (row) => {
      const [webcam, screen] = await Promise.all([
        row.webcam_storage_path
          ? sb.storage.from("session-monitoring").createSignedUrl(row.webcam_storage_path, 3600)
          : Promise.resolve({ data: null }),
        row.screen_storage_path
          ? sb.storage.from("session-monitoring").createSignedUrl(row.screen_storage_path, 3600)
          : Promise.resolve({ data: null }),
      ]);
      return {
        ...row,
        webcam_signed_url: webcam.data?.signedUrl,
        screen_signed_url: screen.data?.signedUrl,
      };
    }),
  );
}

/** @deprecated Use PendingEvidenceRecord */
export type PendingMonitoringSnapshot = {
  eventType: EvidenceEventType;
  sessionTMs: number;
  blob: Blob;
};

export type PendingEvidenceRecord = {
  eventIndex: number;
  eventType: EvidenceEventType;
  sessionTMs: number;
  durationMs?: number;
  webcam: Blob | null;
  screen: Blob | null;
};

export async function uploadEvidenceRecord(input: {
  roomId: string;
  userId: string;
  sessionId: string;
  activityId?: string | null;
  record: PendingEvidenceRecord;
}): Promise<void> {
  const { roomId, userId, sessionId, activityId, record } = input;
  const sb = getSupabaseBrowser();
  const basePath = `${roomId}/${userId}/${sessionId}/${record.eventIndex}`;

  let webcamPath: string | null = null;
  let screenPath: string | null = null;

  if (record.webcam) {
    const path = `${basePath}/webcam.jpg`;
    const { error } = await sb.storage.from("session-monitoring").upload(path, record.webcam, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) console.warn("[evidence] webcam upload failed:", error.message);
    else webcamPath = path;
  }

  if (record.screen) {
    screenPath = `${basePath}/screen.jpg`;
    const { error } = await sb.storage.from("session-monitoring").upload(screenPath, record.screen, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) {
      console.warn("[evidence] screen upload failed:", error.message);
      screenPath = null;
    }
  }

  if (!webcamPath && !screenPath) return;

  const { error: insertErr } = await sb.from("session_evidence_records").insert({
    session_id: sessionId,
    room_id: roomId,
    user_id: userId,
    activity_id: activityId ?? null,
    event_index: record.eventIndex,
    event_type: record.eventType,
    event_description: evidenceEventDescription(record.eventType),
    duration_ms: record.durationMs ?? null,
    session_t_ms: record.sessionTMs,
    webcam_storage_path: webcamPath,
    screen_storage_path: screenPath,
  });
  if (insertErr) console.warn("[evidence] row insert failed:", insertErr.message);
}

/** Legacy webcam-only batch upload (Main Library / old snapshots). */
export async function uploadMonitoringSnapshots(
  roomId: string,
  userId: string,
  sessionId: string,
  pending: PendingMonitoringSnapshot[],
): Promise<void> {
  for (const item of pending) {
    await uploadEvidenceRecord({
      roomId,
      userId,
      sessionId,
      record: {
        eventIndex: 0,
        eventType: item.eventType,
        sessionTMs: item.sessionTMs,
        webcam: item.blob,
        screen: null,
      },
    });
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

export function snapshotEventLabel(type: EvidenceEventType): string {
  return evidenceEventLabel(type);
}
