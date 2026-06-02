"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "@/components/social/ActivityCard";
import { getActivityFeed } from "@/lib/social/feed-service";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import type { ActivityEvent } from "@/lib/social/types";
import { Rss, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const PAGE = 30;

export default function FeedPage() {
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

  const loadMore = async () => {
    if (events.length === 0) return;
    setLoadingMore(true);
    const before = events[events.length - 1].createdAt;
    const rows = await getActivityFeed(before, PAGE);
    setEvents((prev) => [...prev, ...rows]);
    setDone(rows.length < PAGE);
    setLoadingMore(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Activity</h1>
        <p className="mt-1 text-sm text-muted">
          What your study partners are up to.
        </p>
      </div>

      {!isSupabaseEnabled() ? (
        <Card className="text-center text-sm text-muted">
          The activity feed requires a cloud account.
        </Card>
      ) : loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-16 animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
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
          <Link href="/friends">
            <Button>
              <Search className="h-4 w-4" /> Find people
            </Button>
          </Link>
        </Card>
      ) : (
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
      )}
    </div>
  );
}
