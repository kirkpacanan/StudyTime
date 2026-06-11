"use client";

import { SYSTEM_FOCUS_THRESHOLD } from "@/lib/focus/system-config";
import { appendSession } from "@/lib/storage";
import type { FocusSample, SessionEvent } from "@/lib/types";

export function computeSessionStats(
  samples: FocusSample[],
  focusMs: number,
  breakMs: number,
) {
  if (samples.length === 0) {
    return {
      averageFocus: 0,
      focusedRatio: 0,
      distractionEvents: 0,
      focusMs,
      breakMs,
    };
  }
  const avg =
    samples.reduce((a, s) => a + s.score, 0) / Math.max(1, samples.length);
  const focusedRatio =
    (samples.filter((s) => s.score >= SYSTEM_FOCUS_THRESHOLD).length /
      samples.length) *
    100;
  let distractionEvents = 0;
  let prev: FocusSample["state"] | null = null;
  for (const s of samples) {
    if (
      (s.state === "distracted" ||
        s.state === "away" ||
        s.state === "sleeping") &&
      prev !== "distracted" &&
      prev !== "away" &&
      prev !== "sleeping"
    ) {
      distractionEvents++;
    }
    prev = s.state;
  }
  return {
    averageFocus: Math.round(avg),
    focusedRatio: Math.round(focusedRatio),
    distractionEvents,
    focusMs,
    breakMs,
  };
}

export async function persistStudySession(
  userId: string,
  startedAt: string,
  samples: FocusSample[],
  events: SessionEvent[],
  focusMs: number,
  breakMs: number,
  roomId?: string | null,
  sessionId?: string | null,
  activityId?: string | null,
) {
  const stats = computeSessionStats(samples, focusMs, breakMs);
  const session = {
    id: sessionId ?? crypto.randomUUID(),
    userId,
    startedAt,
    endedAt: new Date().toISOString(),
    focusMs: stats.focusMs,
    breakMs: stats.breakMs,
    averageFocus: stats.averageFocus,
    focusedRatio: stats.focusedRatio,
    distractionEvents: stats.distractionEvents,
    samples,
    events,
    roomId: roomId ?? null,
    activityId: activityId ?? null,
  };
  await appendSession(session);
  return session;
}
