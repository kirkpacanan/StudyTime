"use client";

import { useAuth } from "@/hooks/useAuth";
import { useSessionLive } from "@/contexts/session-live-context";
import {
  getFriendsPresence,
  heartbeat,
  type FriendPresence,
} from "@/lib/social/presence-service";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import type { PresenceStatus } from "@/lib/social/types";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type PresenceContextValue = {
  /** Friends' presence keyed by userId. */
  friends: Record<string, PresenceStatus>;
  studyingCount: number;
  refresh: () => void;
};

const PresenceContext = createContext<PresenceContextValue>({
  friends: {},
  studyingCount: 0,
  refresh: () => {},
});

const HEARTBEAT_MS = 30_000;
const POLL_MS = 45_000;

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { live } = useSessionLive();
  const [friends, setFriends] = useState<Record<string, PresenceStatus>>({});
  const userId = user?.id ?? null;

  // Track the latest live state without forcing the heartbeat effect to restart.
  const liveRef = useRef(live);
  liveRef.current = live;

  const enabled = Boolean(userId) && isSupabaseEnabled();

  const applyPresence = (rows: FriendPresence[]) => {
    const map: Record<string, PresenceStatus> = {};
    for (const r of rows) map[r.userId] = r.status;
    setFriends(map);
  };

  const refresh = useRef(() => {});
  refresh.current = () => {
    if (!enabled) return;
    void getFriendsPresence().then(applyPresence);
  };

  // Own heartbeat loop: 'studying' while a session runs, else 'online'.
  useEffect(() => {
    if (!enabled) return;

    const beat = () => {
      const l = liveRef.current;
      const status: PresenceStatus = l.running ? "studying" : "online";
      void heartbeat(status, { focusPhase: l.running ? l.phase : null });
    };

    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      void heartbeat("offline"); // best-effort offline marker on unmount
    };
  }, [enabled]);

  // Immediate heartbeat when the session starts/stops so friends see it fast.
  useEffect(() => {
    if (!enabled) return;
    void heartbeat(live.running ? "studying" : "online", {
      focusPhase: live.running ? live.phase : null,
    });
  }, [enabled, live.running, live.phase]);

  // Friends' presence: initial load, poll, and Realtime invalidation.
  useEffect(() => {
    if (!enabled) return;
    refresh.current();
    const poll = window.setInterval(() => refresh.current(), POLL_MS);

    let channel: ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | null =
      null;
    try {
      const supabase = getSupabaseBrowser();
      channel = supabase
        .channel("presence-friends")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_presence" },
          () => refresh.current(),
        )
        .subscribe();
    } catch {
      /* realtime optional */
    }

    return () => {
      window.clearInterval(poll);
      if (channel) {
        try {
          void getSupabaseBrowser().removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [enabled]);

  const studyingCount = useMemo(
    () => Object.values(friends).filter((s) => s === "studying").length,
    [friends],
  );

  const value = useMemo<PresenceContextValue>(
    () => ({ friends, studyingCount, refresh: () => refresh.current() }),
    [friends, studyingCount],
  );

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
