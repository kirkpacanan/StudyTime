"use client";

import { useEffect } from "react";
import { heartbeat } from "@/lib/social/presence-service";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import type { PresenceStatus } from "@/lib/social/types";

const HEARTBEAT_MS = 15_000;

/**
 * Persists library seat/avatar/room to user_presence for DB-backed occupancy.
 */
export function useLibraryRoomHeartbeat(opts: {
  userId: string | null;
  status: PresenceStatus | "completed";
  focusPhase: string | null;
  seatId: string | null;
  avatarUrl: string | null;
  roomId: string;
  sessionId?: string | null;
}) {
  const { userId, status, focusPhase, seatId, avatarUrl, roomId, sessionId } = opts;

  useEffect(() => {
    if (!isSupabaseEnabled() || !userId) return;

    const presenceStatus: PresenceStatus =
      status === "completed" ? "online" : status;

    const tick = () => {
      void heartbeat(presenceStatus, {
        sessionId: sessionId ?? null,
        focusPhase,
        seatId,
        avatarUrl,
        roomId,
      });
    };

    tick();
    const id = window.setInterval(tick, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [userId, status, focusPhase, seatId, avatarUrl, roomId, sessionId]);
}
