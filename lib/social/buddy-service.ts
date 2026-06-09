/**
 * Study buddy service: request / respond / cancel / unpair.
 * All writes go through SECURITY DEFINER RPCs.
 */

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { SocialUnavailableError } from "./profile-service";
import type { StudyBuddyRequest } from "./types";

function ensureCloud() {
  if (!isSupabaseEnabled()) throw new SocialUnavailableError();
  return getSupabaseBrowser();
}

function humanize(message: string): string {
  return message.replace(/^.*?:\s*/, "").trim() || "Something went wrong.";
}

export async function sendStudyBuddyRequest(
  targetUserId: string,
): Promise<{ ok: true; status: string; requestId?: string } | { ok: false; error: string }> {
  const supabase = ensureCloud();
  const { data, error } = await supabase.rpc("send_study_buddy_request", {
    p_target: targetUserId,
  });
  if (error) return { ok: false, error: humanize(error.message) };
  const row = data as { status?: string; requestId?: string };
  return {
    ok: true,
    status: String(row?.status ?? "pending"),
    requestId: row?.requestId ? String(row.requestId) : undefined,
  };
}

export async function respondStudyBuddyRequest(
  requestId: string,
  accept: boolean,
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const supabase = ensureCloud();
  const { data, error } = await supabase.rpc("respond_study_buddy_request", {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) return { ok: false, error: humanize(error.message) };
  return { ok: true, status: String((data as { status?: string })?.status ?? "") };
}

export async function cancelStudyBuddyRequest(
  requestId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = ensureCloud();
  const { error } = await supabase.rpc("cancel_study_buddy_request", {
    p_request_id: requestId,
  });
  if (error) return { ok: false, error: humanize(error.message) };
  return { ok: true };
}

export async function listStudyBuddyRequests(
  inbox: boolean,
): Promise<StudyBuddyRequest[]> {
  const supabase = ensureCloud();
  const { data, error } = await supabase.rpc("list_study_buddy_requests", {
    p_inbox: inbox,
  });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    requestId: String(r.requestId),
    userId: String(r.userId),
    username: (r.username as string | null) ?? null,
    publicUid: String(r.publicUid ?? ""),
    displayName: String(r.displayName ?? "Student"),
    avatarId: (r.avatarId as string | null) ?? null,
    frameId: (r.frameId as string | null) ?? null,
    level: Number(r.level ?? 1),
    createdAt: String(r.createdAt ?? new Date().toISOString()),
  }));
}
