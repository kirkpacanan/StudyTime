"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "@/components/social/ActivityCard";
import { getActivityFeed } from "@/lib/social/feed-service";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import type { ActivityEvent } from "@/lib/social/types";
import { Rss, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const PAGE = 30;

export function ActivityFeedPanel({
  onFindPeople,
}: {
  onFindPeople: () => void;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);

  const loadInitial = useCallback(async () => {
    if (!isSupabaseEnabled()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await getActivityFeed(null, PAGE);
    setEvents(rows);
    setDone(rows.length < PAGE);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!isSupabaseEnabled()) return;
    let channel: ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | null =
      null;
    try {
      const supabase = getSupabaseBrowser();
      channel = supabase
        .channel("activity-feed")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "activity_events" },
          () => void loadInitial(),
        )
        .subscribe();
    } catch {
      /* realtime optional */
    }
    return () => {
      if (channel) {
        try {
          void getSupabaseBrowser().removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [loadInitial]);

  const loadMore = async () => {
    if (events.length === 0) return;
    setLoadingMore(true);
    const before = events[events.length - 1].createdAt;
    const rows = await getActivityFeed(before, PAGE);
    setEvents((prev) => [...prev, ...rows]);
    setDone(rows.length < PAGE);
    setLoadingMore(false);
  };

  if (!isSupabaseEnabled()) {
    return (
      <Card className="text-center text-sm text-muted">
        The activity feed requires a cloud account.
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/40 text-muted dark:bg-white/10">
          <Rss className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text">Your feed is quiet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Add friends to see their study sessions, streaks, and achievements
            here.
          </p>
        </div>
        <Button onClick={onFindPeople}>
          <Search className="h-4 w-4" /> Find people
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((e) => (
        <ActivityCard key={e.id} event={e} />
      ))}
      {!done ? (
        <div className="pt-2 text-center">
          <Button
            variant="secondary"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : (
        <p className="py-3 text-center text-xs text-muted">
          You&apos;re all caught up.
        </p>
      )}
    </div>
  );
}
