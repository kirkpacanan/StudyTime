"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { FocusFrameResult } from "@/lib/focus-detection";
import {
  flagSession,
  upsertFocusSession,
} from "@/lib/focus-hub/client";
import {
  scoreToFocusStatus,
  type FocusHubBroadcastPayload,
  type FocusHubSamplePoint,
  type ParticipantLiveState,
} from "@/lib/focus-hub/types";
import type { FocusSampleState } from "@/lib/types";

const LOW_FOCUS_THRESHOLD = 50;
const FLAG_AFTER_TICKS = 3;
const BROADCAST_INTERVAL_MS = 4000;
const PERSIST_INTERVAL_MS = 30_000;
const STALE_PEER_MS = 20_000;

// ── Participant hook ──────────────────────────────────────────────────────────

type UseParticipantFocusHubOptions = {
  activityId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
};

export function useParticipantFocusHub({
  activityId,
  userId,
  name,
  avatarUrl,
}: UseParticipantFocusHubOptions) {
  const samplesRef = useRef<FocusHubSamplePoint[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const lastBroadcastRef = useRef<number>(0);
  const lastPersistRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof getSupabaseBrowser>["channel"] extends (name: string) => infer R ? R : never | null>(null);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    const ch = sb.channel(`focus-hub-activity-${activityId}`, {
      config: { broadcast: { self: false } },
    });
    ch.subscribe();
    channelRef.current = ch;

    return () => {
      void sb.removeChannel(ch);
    };
  }, [activityId]);

  const broadcastSample = useCallback(
    (sample: FocusFrameResult) => {
      const now = Date.now();
      const t = now - startTimeRef.current;

      // Always record locally
      samplesRef.current.push({ t, score: sample.score, state: sample.state });

      // Throttled broadcast
      if (now - lastBroadcastRef.current >= BROADCAST_INTERVAL_MS) {
        lastBroadcastRef.current = now;
        const payload: FocusHubBroadcastPayload = {
          userId,
          name,
          avatarUrl,
          score: sample.score,
          state: sample.state,
          flagged: false,
        };
        channelRef.current?.send({
          type: "broadcast",
          event: "focus_update",
          payload,
        });
      }

      // Periodic persist
      if (now - lastPersistRef.current >= PERSIST_INTERVAL_MS) {
        lastPersistRef.current = now;
        const samples = [...samplesRef.current];
        const avg =
          samples.length > 0
            ? samples.reduce((s, p) => s + p.score, 0) / samples.length
            : 0;
        void upsertFocusSession(activityId, samples, avg);
      }
    },
    [activityId, userId, name, avatarUrl],
  );

  const flush = useCallback(async () => {
    const samples = [...samplesRef.current];
    if (samples.length === 0) return;
    const avg = samples.reduce((s, p) => s + p.score, 0) / samples.length;
    await upsertFocusSession(activityId, samples, avg);
  }, [activityId]);

  return { broadcastSample, flush };
}

// ── Host hook ─────────────────────────────────────────────────────────────────

type UseHostFocusHubOptions = {
  activityId: string;
  roomId: string;
};

export function useHostFocusHub({ activityId, roomId }: UseHostFocusHubOptions) {
  const [participants, setParticipants] = useState<Map<string, ParticipantLiveState>>(
    new Map(),
  );
  const stateRef = useRef<Map<string, ParticipantLiveState>>(new Map());

  const updateParticipant = useCallback(
    (payload: FocusHubBroadcastPayload) => {
      const prev = stateRef.current.get(payload.userId);
      const lowFocusTicks =
        payload.score < LOW_FOCUS_THRESHOLD
          ? (prev?.lowFocusTicks ?? 0) + 1
          : 0;
      const shouldFlag = lowFocusTicks >= FLAG_AFTER_TICKS;

      const next: ParticipantLiveState = {
        userId: payload.userId,
        name: payload.name,
        avatarUrl: payload.avatarUrl,
        score: payload.score,
        state: payload.state,
        focusStatus: scoreToFocusStatus(payload.score),
        flagged: shouldFlag,
        lowFocusTicks,
        lastSeenAt: Date.now(),
      };

      stateRef.current.set(payload.userId, next);

      // Persist flag to DB when newly flagged
      if (shouldFlag && !prev?.flagged) {
        void flagSession(activityId, payload.userId);
      }

      // Trigger re-render by replacing the map
      setParticipants(new Map(stateRef.current));
    },
    [activityId],
  );

  // Prune stale peers
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [uid, p] of stateRef.current) {
        if (now - p.lastSeenAt > STALE_PEER_MS) {
          stateRef.current.delete(uid);
          changed = true;
        }
      }
      if (changed) setParticipants(new Map(stateRef.current));
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  // Subscribe to broadcast channel
  useEffect(() => {
    const sb = getSupabaseBrowser();
    const ch = sb
      .channel(`focus-hub-activity-${activityId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "focus_update" }, ({ payload }) => {
        updateParticipant(payload as FocusHubBroadcastPayload);
      })
      .subscribe();

    return () => {
      void sb.removeChannel(ch);
    };
  }, [activityId, updateParticipant]);

  // Also subscribe to DB changes on focus_hub_sessions for flag state
  useEffect(() => {
    const sb = getSupabaseBrowser();
    const ch = sb
      .channel(`focus-hub-sessions-${activityId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "focus_hub_sessions",
          filter: `activity_id=eq.${activityId}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string; flagged: boolean; average_focus: number };
          const existing = stateRef.current.get(row.user_id);
          if (existing && row.flagged) {
            stateRef.current.set(row.user_id, { ...existing, flagged: true });
            setParticipants(new Map(stateRef.current));
          }
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(ch);
    };
  }, [activityId, roomId]);

  // Sorted participants: flagged first, then by score descending
  const sortedParticipants = [...participants.values()].sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
    return b.score - a.score;
  });

  const flaggedCount = sortedParticipants.filter((p) => p.flagged).length;
  const avgScore =
    sortedParticipants.length > 0
      ? Math.round(
          sortedParticipants.reduce((s, p) => s + p.score, 0) /
            sortedParticipants.length,
        )
      : 0;

  return { participants: sortedParticipants, flaggedCount, avgScore };
}

// ── Shared utility: derive FocusSampleState label ─────────────────────────────

export function stateLabel(state: FocusSampleState): string {
  switch (state) {
    case "focused": return "Focused";
    case "drifting": return "Slightly Distracted";
    case "distracted": return "Distracted";
    case "sleeping": return "Inactive";
    default: return "Away";
  }
}
