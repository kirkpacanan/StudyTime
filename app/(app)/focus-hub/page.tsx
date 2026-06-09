"use client";

import { RoomCard } from "@/components/focus-hub/RoomCard";
import { CreateRoomSheet } from "@/components/focus-hub/CreateRoomSheet";
import { getMyRooms, getRecentRoomActivities } from "@/lib/focus-hub/client";
import type { FocusHubRoom, RoomWithRole } from "@/lib/focus-hub/types";
import { motion } from "framer-motion";
import { GraduationCap, Hash, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const ease = [0.16, 1, 0.3, 1] as const;
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.36, ease } },
};

export default function FocusHubPage() {
  const [rooms, setRooms] = useState<RoomWithRole[]>([]);
  const [recentActivity, setRecentActivity] = useState<
    Array<{ activity: { id: string; title: string; status: string }; room: FocusHubRoom }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const [r, recent] = await Promise.all([getMyRooms(), getRecentRoomActivities()]);
      setRooms(r);
      setRecentActivity(
        recent as Array<{ activity: { id: string; title: string; status: string }; room: FocusHubRoom }>,
      );
      setLoading(false);
    })();
  }, []);

  function handleRoomCreated(room: FocusHubRoom) {
    setRooms((prev) => {
      if (prev.some((r) => r.id === room.id)) return prev;
      return [{ ...room, role: "host", memberCount: 1 }, ...prev];
    });
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-5xl space-y-8"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text">Focus Hub</h1>
          </div>
          <p className="text-sm text-muted">
            Create or join rooms to run focus-tracked activities with your team or class.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/focus-hub/join"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--cc-border)] bg-white/5 px-3 py-2 text-sm font-medium text-muted transition hover:text-text"
          >
            <Hash className="h-4 w-4" />
            Join Room
          </Link>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white shadow transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Room
          </button>
        </div>
      </motion.div>

      {/* My Rooms */}
      <motion.section variants={item}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          My Rooms
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-[var(--cc-border)] bg-white/5"
              />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--cc-border)] py-16 text-center">
            <GraduationCap className="h-10 w-10 text-muted/40" />
            <p className="text-sm font-medium text-muted">No rooms yet</p>
            <p className="text-xs text-muted/70">
              Create your first room or join one with a code.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Create Room
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </motion.section>

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <motion.section variants={item}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Recent Activity
          </h2>
          <div className="space-y-2">
            {recentActivity.map(({ activity, room }) => (
              <Link
                key={activity.id}
                href={`/focus-hub/${room.id}/activities/${activity.id}`}
                className="flex items-center justify-between rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] px-4 py-3 text-sm transition hover:bg-white/5"
              >
                <div>
                  <p className="font-medium text-text">{activity.title}</p>
                  <p className="text-xs text-muted">{room.name}</p>
                </div>
                <span
                  className={
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold " +
                    (activity.status === "active"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-slate-500/15 text-muted")
                  }
                >
                  {activity.status === "active" ? "Live" : "Completed"}
                </span>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      <CreateRoomSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleRoomCreated}
      />
    </motion.div>
  );
}
