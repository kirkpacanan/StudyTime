"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import type { PresenceStatus } from "@/lib/social/types";

export type LibraryFlowState =
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
};

const CHANNEL_NAME = "studytime-library-room";
const HEARTBEAT_MS = 15_000;

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
  const [peers, setPeers] = useState<Map<string, LibraryPeer>>(new Map());
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const broadcastSelf = useCallback(() => {
    if (!channelRef.current || !optsRef.current.userId) return;
    const payload: BroadcastPayload = {
      userId: optsRef.current.userId,
      displayName: optsRef.current.displayName,
      avatarUrl: optsRef.current.avatarUrl,
      seatId: optsRef.current.seatId,
      status: optsRef.current.status,
      focusPhase: optsRef.current.focusPhase,
      focusScore: optsRef.current.focusScore,
      sessionDurationMs: optsRef.current.sessionDurationMs,
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

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });

    channelRef.current = channel;

    channel
      .on("broadcast", { event: "peer_update" }, ({ payload }: { payload: BroadcastPayload }) => {
        if (!payload?.userId) return;
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
        if (status === "SUBSCRIBED") {
          broadcastSelf();
        }
      });

    // Heartbeat to keep presence alive and propagate updates.
    const heartbeatId = window.setInterval(broadcastSelf, HEARTBEAT_MS);

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
      // Announce departure.
      if (opts.userId) {
        void channel.send({
          type: "broadcast",
          event: "peer_leave",
          payload: { userId: opts.userId },
        });
      }
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.userId]);

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

  const studyingCount = [...peers.values()].filter(
    (p) => p.status === "studying",
  ).length;

  return { peers, studyingCount, broadcastSelf };
}
