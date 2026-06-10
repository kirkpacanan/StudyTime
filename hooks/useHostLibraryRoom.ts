"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { scoreToFocusStatus, type ParticipantLiveState } from "@/lib/focus-hub/types";
import type { FocusSampleState } from "@/lib/types";
import {
  libraryPresenceChannelName,
  type LibraryPeer,
} from "@/hooks/useLibraryPresence";

const LOW_FOCUS_THRESHOLD = 50;
const FLAG_AFTER_TICKS = 3;
const STALE_PEER_MS = 20_000;

type LibraryBroadcastPayload = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  seatId: string | null;
  status: string;
  focusPhase: string | null;
  focusScore: number;
  sessionDurationMs: number;
  roomId: string;
};

function scoreToState(score: number): FocusSampleState {
  if (score >= 70) return "focused";
  if (score >= 50) return "drifting";
  if (score >= 20) return "distracted";
  return "away";
}

function peerToPayload(peer: LibraryPeer, roomId: string): LibraryBroadcastPayload {
  return {
    userId: peer.userId,
    displayName: peer.displayName,
    avatarUrl: peer.avatarUrl,
    seatId: peer.seatId,
    status: peer.status,
    focusPhase: peer.focusPhase,
    focusScore: peer.focusScore,
    sessionDurationMs: peer.sessionDurationMs,
    roomId,
  };
}

/** Host live monitor for members studying in a private library room. */
export function useHostLibraryRoom(roomId: string) {
  const [participants, setParticipants] = useState<Map<string, ParticipantLiveState>>(
    new Map(),
  );
  const stateRef = useRef<Map<string, ParticipantLiveState>>(new Map());

  const updateParticipant = useCallback((payload: LibraryBroadcastPayload) => {
    if (payload.status !== "studying") {
      if (stateRef.current.has(payload.userId)) {
        stateRef.current.delete(payload.userId);
        setParticipants(new Map(stateRef.current));
      }
      return;
    }

    const prev = stateRef.current.get(payload.userId);
    const lowFocusTicks =
      payload.focusScore < LOW_FOCUS_THRESHOLD
        ? (prev?.lowFocusTicks ?? 0) + 1
        : 0;
    const shouldFlag = lowFocusTicks >= FLAG_AFTER_TICKS;
    const state = scoreToState(payload.focusScore);

    const next: ParticipantLiveState = {
      userId: payload.userId,
      name: payload.displayName,
      avatarUrl: payload.avatarUrl,
      score: payload.focusScore,
      state,
      focusStatus: scoreToFocusStatus(payload.focusScore),
      flagged: shouldFlag,
      lowFocusTicks,
      lastSeenAt: Date.now(),
    };

    stateRef.current.set(payload.userId, next);
    setParticipants(new Map(stateRef.current));
  }, []);

  useEffect(() => {
    const pruneId = window.setInterval(() => {
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
    return () => window.clearInterval(pruneId);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const sb = getSupabaseBrowser();
    const channelName = libraryPresenceChannelName(roomId);
    const ch = sb
      .channel(channelName, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "peer_update" }, ({ payload }) => {
        const p = payload as LibraryBroadcastPayload;
        if (p.roomId && p.roomId !== roomId) return;
        updateParticipant(p);
      })
      .subscribe();

    return () => {
      void sb.removeChannel(ch);
    };
  }, [roomId, updateParticipant]);

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

export { peerToPayload };
