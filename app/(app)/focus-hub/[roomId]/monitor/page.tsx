"use client";

import { LiveFocusGrid } from "@/components/focus-hub/LiveFocusGrid";
import { getRoomActivities, getRoomRole } from "@/lib/focus-hub/client";
import { useHostFocusHub } from "@/hooks/useFocusHubRoom";
import type { FocusHubActivity } from "@/lib/focus-hub/types";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function ActiveMonitor({ activityId, roomId }: { activityId: string; roomId: string }) {
  const { participants, flaggedCount, avgScore } = useHostFocusHub({
    activityId,
    roomId,
  });

  return (
    <LiveFocusGrid
      participants={participants}
      avgScore={avgScore}
      flaggedCount={flaggedCount}
    />
  );
}

export default function LiveMonitorPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [activities, setActivities] = useState<FocusHubActivity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [role, setRole] = useState<"host" | "participant" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [acts, r] = await Promise.all([
        getRoomActivities(roomId),
        getRoomRole(roomId),
      ]);
      const active = acts.filter((a) => a.status === "active");
      setActivities(active);
      if (active.length > 0) setSelectedActivity(active[0]!.id);
      setRole(r);
      setLoading(false);
    })();
  }, [roomId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-white/5" />
      </div>
    );
  }

  if (role !== "host") {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center text-muted">
        <ShieldAlert className="h-10 w-10 opacity-40" />
        <p className="text-sm">Live Monitor is only accessible to hosts.</p>
        <Link href={`/focus-hub/${roomId}`} className="text-sm text-primary hover:underline">
          Back to Room
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36 }}
      className="mx-auto max-w-5xl space-y-6"
    >
      <div className="flex items-center gap-3">
        <Link
          href={`/focus-hub/${roomId}`}
          className="rounded-xl border border-[var(--cc-border)] p-2 text-muted transition hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-text">Live Focus Monitor</h1>
          <p className="text-xs text-muted">Real-time participant focus tracking</p>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--cc-border)] py-16 text-center text-muted">
          <p className="text-sm">No active activities right now.</p>
          <p className="text-xs opacity-70">Start an activity to begin monitoring participants.</p>
          <Link
            href={`/focus-hub/${roomId}`}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Go to Activities
          </Link>
        </div>
      ) : (
        <>
          {/* Activity selector */}
          {activities.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {activities.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedActivity(a.id)}
                  className={
                    "shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition " +
                    (selectedActivity === a.id
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-[var(--cc-border)] bg-white/5 text-muted hover:text-text")
                  }
                >
                  {a.title}
                </button>
              ))}
            </div>
          )}

          {selectedActivity && (
            <ActiveMonitor activityId={selectedActivity} roomId={roomId} />
          )}
        </>
      )}
    </motion.div>
  );
}
