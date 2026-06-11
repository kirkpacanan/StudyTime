"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { getLibraryRoomPresence } from "@/lib/library-rooms";
import type { PresenceStatus } from "@/lib/social/types";

export type LibraryFlowState =
  | "library_select"
  | "entering"
  | "seat_select"
  | "duration_select"
  | "studying"
  | "session_end";

export type LibraryPeer = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  seatId: string | null;
  status: PresenceStatus | "completed";
  focusPhase: string | null;
  focusScore: number;
  sessionDurationMs: number;
  lastSeenAt: string;
};

type BroadcastPayload = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  seatId: string | null;
  status: PresenceStatus | "completed";
  focusPhase: string | null;
  focusScore: number;
  sessionDurationMs: number;
  roomId: string;
};

const HEARTBEAT_MS = 15_000;

/** Realtime channel name for a library room (`main` = public Main Library). */
export function libraryPresenceChannelName(roomId: string = "main"): string {
  return `studytime-library-${roomId}`;
}

/**
 * Manages real-time seat occupancy and peer presence for the 3D library.
 * Uses a Supabase Realtime broadcast channel for low-latency updates.
 * Falls back to offline-only mode when Supabase is not configured.
 */
export function useLibraryPresence(opts: {
  userId: string | null;
  displayName: string;
  avatarUrl: string | null;
  seatId: string | null;
  status: PresenceStatus | "completed";
  focusPhase: string | null;
  focusScore: number;
  sessionDurationMs: number;
  roomId?: string;
}) {
  const roomId = opts.roomId ?? "main";
  const [peers, setPeers] = useState<Map<string, LibraryPeer>>(new Map());
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Track the last-broadcast score so we only send when it moves ≥5 points,
  // preventing a Supabase broadcast on every ~1 Hz UI update.
  const lastBroadcastScoreRef = useRef<number>(-1);
  const subscribedRef = useRef(false);

  const broadcastSelf = useCallback((force = false) => {
    if (!channelRef.current || !optsRef.current.userId || !subscribedRef.current) return;
    const score = optsRef.current.focusScore;
    // Skip the network round-trip when only the score changed by < 5 points —
    // this avoids a broadcast on every ~1 Hz sample tick.
    if (
      !force &&
      lastBroadcastScoreRef.current !== -1 &&
      Math.abs(score - lastBroadcastScoreRef.current) < 5
    ) return;
    lastBroadcastScoreRef.current = score;
    const payload: BroadcastPayload = {
      userId: optsRef.current.userId,
      displayName: optsRef.current.displayName,
      avatarUrl: optsRef.current.avatarUrl,
      seatId: optsRef.current.seatId,
      status: optsRef.current.status,
      focusPhase: optsRef.current.focusPhase,
      focusScore: score,
      sessionDurationMs: optsRef.current.sessionDurationMs,
      roomId: optsRef.current.roomId ?? "main",
    };
    void channelRef.current.send({
      type: "broadcast",
      event: "peer_update",
      payload,
    });
  }, []);

  useEffect(() => {
    if (!isSupabaseEnabled() || !opts.userId) return;

    const supabase = getSupabaseBrowser();

    const channelName = libraryPresenceChannelName(roomId);
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channelRef.current = channel;

    channel
      .on("broadcast", { event: "peer_update" }, ({ payload }: { payload: BroadcastPayload }) => {
        if (!payload?.userId) return;
        if (payload.roomId && payload.roomId !== roomId) return;
        setPeers((prev) => {
          const next = new Map(prev);
          next.set(payload.userId, {
            userId: payload.userId,
            displayName: payload.displayName ?? "Student",
            avatarUrl: payload.avatarUrl ?? null,
            seatId: payload.seatId ?? null,
            status: payload.status ?? "online",
            focusPhase: payload.focusPhase ?? null,
            focusScore: payload.focusScore ?? 0,
            sessionDurationMs: payload.sessionDurationMs ?? 0,
            lastSeenAt: new Date().toISOString(),
          });
          return next;
        });
      })
      .on("broadcast", { event: "peer_leave" }, ({ payload }: { payload: { userId: string } }) => {
        if (!payload?.userId) return;
        setPeers((prev) => {
          const next = new Map(prev);
          next.delete(payload.userId);
          return next;
        });
      })
      .subscribe((status) => {
        subscribedRef.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") {
          broadcastSelf(true);
          void getLibraryRoomPresence(roomId).then((rows) => {
            if (rows.length === 0) return;
            setPeers((prev) => {
              const next = new Map(prev);
              for (const row of rows) {
                if (!row.user_id || row.user_id === opts.userId) continue;
                next.set(row.user_id, {
                  userId: row.user_id,
                  displayName: "Student",
                  avatarUrl: row.avatar_url ?? null,
                  seatId: row.seat_id ?? null,
                  status: (row.status as PresenceStatus) ?? "online",
                  focusPhase: row.focus_phase ?? null,
                  focusScore: 0,
                  sessionDurationMs: 0,
                  lastSeenAt: row.last_seen_at ?? new Date().toISOString(),
                });
              }
              return next;
            });
          });
        }
      });

    // Heartbeat: force-broadcast even without a score change so peers stay live.
    const heartbeatId = window.setInterval(() => broadcastSelf(true), HEARTBEAT_MS);

    // Prune stale peers (gone > 60s without update).
    const pruneId = window.setInterval(() => {
      const cutoff = Date.now() - 60_000;
      setPeers((prev) => {
        const next = new Map(prev);
        for (const [id, peer] of next) {
          if (new Date(peer.lastSeenAt).getTime() < cutoff) {
            next.delete(id);
          }
        }
        return next;
      });
    }, 20_000);

    return () => {
      window.clearInterval(heartbeatId);
      window.clearInterval(pruneId);
      subscribedRef.current = false;
      // Announce departure (httpSend when the socket is already torn down).
      if (opts.userId) {
        void channel.httpSend("peer_leave", { userId: opts.userId });
      }
      void supabase.removeChannel(channel);
      channelRef.current = null;
      setPeers(new Map());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.userId, roomId]);

  // Broadcast whenever key state changes.
  useEffect(() => {
    broadcastSelf();
  }, [
    opts.seatId,
    opts.status,
    opts.focusPhase,
    opts.focusScore,
    opts.avatarUrl,
    broadcastSelf,
  ]);

  /** Seated players in an active study session (includes self when applicable). */
  const studyingCount = useMemo(() => {
    let count = 0;
    for (const p of peers.values()) {
      if (p.status === "studying" && p.seatId) count++;
    }
    if (opts.userId && opts.seatId && opts.status === "studying") count++;
    return count;
  }, [peers, opts.userId, opts.seatId, opts.status]);

  return { peers, studyingCount, broadcastSelf };
}
