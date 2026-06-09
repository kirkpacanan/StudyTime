import type { FocusSampleState } from "@/lib/types";

// ── Enums ─────────────────────────────────────────────────────────────────────

export type RoomRole = "host" | "participant";

export type ActivityType =
  | "study_session"
  | "assignment"
  | "quiz"
  | "training"
  | "meeting";

export type ActivityStatus = "draft" | "active" | "completed";

export type FocusHubFocusStatus =
  | "highly_focused"
  | "focused"
  | "slightly_distracted"
  | "distracted"
  | "inactive";

// ── DB row types ──────────────────────────────────────────────────────────────

export type FocusHubRoom = {
  id: string;
  created_by: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  join_code: string;
  participant_limit: number;
  is_private: boolean;
  archived_at: string | null;
  created_at: string;
};

export type FocusHubMembership = {
  id: string;
  room_id: string;
  user_id: string;
  role: RoomRole;
  joined_at: string;
};

export type FocusHubActivity = {
  id: string;
  room_id: string;
  created_by: string;
  title: string;
  description: string | null;
  instructions: string | null;
  activity_type: ActivityType;
  due_at: string | null;
  duration_minutes: number | null;
  focus_required: boolean;
  status: ActivityStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

export type FocusHubSession = {
  id: string;
  activity_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  average_focus: number | null;
  samples: FocusHubSamplePoint[];
  flagged: boolean;
  submitted: boolean;
};

// ── Sample stored per-tick ────────────────────────────────────────────────────

export type FocusHubSamplePoint = {
  t: number;       // ms from session start
  score: number;   // 0-100
  state: FocusSampleState;
};

// ── Real-time live state ──────────────────────────────────────────────────────

export type ParticipantLiveState = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  score: number;
  state: FocusSampleState;
  focusStatus: FocusHubFocusStatus;
  flagged: boolean;
  /** consecutive low-focus tick counter used for flagging */
  lowFocusTicks: number;
  lastSeenAt: number; // Date.now()
};

// ── Broadcast message shape ───────────────────────────────────────────────────

export type FocusHubBroadcastPayload = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  score: number;
  state: FocusSampleState;
  flagged: boolean;
};

// ── Analytics ─────────────────────────────────────────────────────────────────

export type RoomAnalyticsRow = {
  activity_id: string;
  activity_title: string;
  activity_type: ActivityType;
  started_at: string | null;
  ended_at: string | null;
  participant_count: number;
  avg_focus: number | null;
  max_focus: number | null;
  min_focus: number | null;
  flagged_count: number;
  submitted_count: number;
};

// ── Room with membership context ──────────────────────────────────────────────

export type RoomWithRole = FocusHubRoom & {
  role: RoomRole;
  memberCount: number;
};

// ── Create/Update input types ─────────────────────────────────────────────────

export type CreateRoomInput = {
  name: string;
  description?: string;
  category?: string;
  participant_limit?: number;
  is_private?: boolean;
};

export type CreateActivityInput = {
  room_id: string;
  title: string;
  description?: string;
  instructions?: string;
  activity_type: ActivityType;
  due_at?: string;
  duration_minutes?: number;
  focus_required?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function scoreToFocusStatus(score: number): FocusHubFocusStatus {
  if (score >= 85) return "highly_focused";
  if (score >= 65) return "focused";
  if (score >= 50) return "slightly_distracted";
  if (score >= 20) return "distracted";
  return "inactive";
}

export function focusStatusColor(status: FocusHubFocusStatus): string {
  switch (status) {
    case "highly_focused": return "emerald";
    case "focused": return "green";
    case "slightly_distracted": return "yellow";
    case "distracted": return "red";
    case "inactive": return "slate";
  }
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  study_session: "Study Session",
  assignment: "Assignment",
  quiz: "Quiz",
  training: "Training",
  meeting: "Meeting",
};
