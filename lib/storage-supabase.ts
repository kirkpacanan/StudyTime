import type { SupabaseLeaderboardRpcRow } from "@/lib/gamification/leaderboard";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { StoredUserSettings, StudySession } from "@/lib/types";

type SessionRow = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  focus_ms: number;
  break_ms: number;
  average_focus: number;
  focused_ratio: number;
  distraction_events: number;
  samples: StudySession["samples"];
  events: StudySession["events"] | null;
  room_id: string | null;
};

function mapRow(row: SessionRow): StudySession {
  return {
    id: row.id,
    userId: row.user_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    focusMs: row.focus_ms,
    breakMs: row.break_ms,
    averageFocus: row.average_focus,
    focusedRatio: row.focused_ratio,
    distractionEvents: row.distraction_events,
    samples: row.samples ?? [],
    events: row.events ?? undefined,
    roomId: row.room_id ?? null,
  };
}

export async function fetchSessionsForUser(
  userId: string,
): Promise<StudySession[]> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as SessionRow[]).map(mapRow);
}

export async function beginStudySessionRecord(input: {
  id: string;
  userId: string;
  startedAt: string;
  roomId?: string | null;
  activityId?: string | null;
}): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from("study_sessions").insert({
    id: input.id,
    user_id: input.userId,
    started_at: input.startedAt,
    ended_at: input.startedAt,
    focus_ms: 0,
    break_ms: 0,
    average_focus: 0,
    focused_ratio: 0,
    distraction_events: 0,
    samples: [],
    events: [],
    room_id: input.roomId ?? null,
    activity_id: input.activityId ?? null,
  });
  if (error) throw error;
}

function studySessionRow(session: StudySession) {
  return {
    id: session.id,
    user_id: session.userId,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    focus_ms: session.focusMs,
    break_ms: session.breakMs,
    average_focus: session.averageFocus,
    focused_ratio: session.focusedRatio,
    distraction_events: session.distractionEvents,
    samples: session.samples,
    events: session.events ?? null,
    room_id: session.roomId ?? null,
    activity_id: session.activityId ?? null,
  };
}

export async function insertStudySession(session: StudySession): Promise<void> {
  const supabase = getSupabaseBrowser();
  const row = studySessionRow(session);

  const { data: existing, error: readErr } = await supabase
    .from("study_sessions")
    .select("id")
    .eq("id", session.id)
    .maybeSingle();
  if (readErr) throw readErr;

  if (existing) {
    const { error } = await supabase
      .from("study_sessions")
      .update({
        ended_at: row.ended_at,
        focus_ms: row.focus_ms,
        break_ms: row.break_ms,
        average_focus: row.average_focus,
        focused_ratio: row.focused_ratio,
        distraction_events: row.distraction_events,
        samples: row.samples,
        events: row.events,
        room_id: row.room_id,
        activity_id: row.activity_id,
      })
      .eq("id", session.id)
      .eq("user_id", session.userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("study_sessions").insert(row);
  if (error) throw error;
}

export async function fetchUserSettingsRaw(
  userId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.settings ?? {}) as Record<string, unknown>;
}

export async function upsertUserSettings(
  userId: string,
  settings: StoredUserSettings,
): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from("user_settings").upsert(
    { user_id: userId, settings },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function fetchLeaderboardMonthly(
  yearMonth: string,
): Promise<SupabaseLeaderboardRpcRow[]> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.rpc("leaderboard_monthly", {
    p_year_month: yearMonth,
  });
  if (error) throw error;
  return (data ?? []) as SupabaseLeaderboardRpcRow[];
}

export async function fetchLeaderboardAllTime(): Promise<
  SupabaseLeaderboardRpcRow[]
> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.rpc("leaderboard_all_time");
  if (error) throw error;
  return (data ?? []) as SupabaseLeaderboardRpcRow[];
}

export async function fetchLeaderboardWeekly(
  weekStart: string,
): Promise<SupabaseLeaderboardRpcRow[]> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.rpc("leaderboard_weekly", {
    p_week_start: weekStart,
  });
  if (error) throw error;
  return (data ?? []) as SupabaseLeaderboardRpcRow[];
}
