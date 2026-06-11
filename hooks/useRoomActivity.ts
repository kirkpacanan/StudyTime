"use client";

import { getRoomActivities } from "@/lib/focus-hub/client";
import type { FocusHubActivity } from "@/lib/focus-hub/types";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { useCallback, useEffect, useMemo, useState } from "react";

export type RoomActivityState = {
  activity: FocusHubActivity | null;
  loading: boolean;
  error: string | null;
  isActive: boolean;
  canParticipantStart: boolean;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  refresh: () => Promise<void>;
};

function pickCurrentActivity(activities: FocusHubActivity[]): FocusHubActivity | null {
  const active = activities.find((a) => a.status === "active");
  if (active) return active;
  const draft = activities.find((a) => a.status === "draft");
  return draft ?? activities[0] ?? null;
}

export function useRoomActivity(roomId: string | undefined): RoomActivityState {
  const [activity, setActivity] = useState<FocusHubActivity | null>(null);
  const [loading, setLoading] = useState(Boolean(roomId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!roomId) {
      setActivity(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getRoomActivities(roomId);
      setActivity(pickCurrentActivity(list));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load activity");
      setActivity(null);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!roomId || !isSupabaseEnabled()) return;
    const sb = getSupabaseBrowser();
    const channel = sb
      .channel(`room-activity-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "focus_hub_activities",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [roomId, refresh]);

  const scheduledStart = useMemo(
    () => (activity?.scheduled_start_at ? new Date(activity.scheduled_start_at) : null),
    [activity?.scheduled_start_at],
  );
  const scheduledEnd = useMemo(
    () => (activity?.scheduled_end_at ? new Date(activity.scheduled_end_at) : null),
    [activity?.scheduled_end_at],
  );

  const isActive = activity?.status === "active";

  return {
    activity,
    loading,
    error,
    isActive,
    canParticipantStart: isActive,
    scheduledStart,
    scheduledEnd,
    refresh,
  };
}
