import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { StudySession, UserSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

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

export async function insertStudySession(session: StudySession): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from("study_sessions").insert({
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
  });
  if (error) throw error;
}

export async function fetchUserSettings(
  userId: string,
): Promise<UserSettings> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const partial = (data?.settings ?? {}) as Partial<UserSettings>;
  return { ...DEFAULT_SETTINGS, ...partial };
}

export async function upsertUserSettings(
  userId: string,
  settings: UserSettings,
): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from("user_settings").upsert(
    { user_id: userId, settings },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
