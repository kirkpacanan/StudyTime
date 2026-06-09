"use client";

import { ActivityCard } from "@/components/focus-hub/ActivityCard";
import { CreateActivitySheet } from "@/components/focus-hub/CreateActivitySheet";
import { FocusHubTabBar, type FocusHubTab } from "@/components/focus-hub/FocusHubTabBar";
import { RoomStream } from "@/components/focus-hub/RoomStream";
import {
  endActivity,
  getActivity,
  getRoomActivities,
  getRoomById,
  getRoomMembers,
  getRoomRole,
  startActivity,
} from "@/lib/focus-hub/client";
import type { FocusHubActivity, FocusHubRoom } from "@/lib/focus-hub/types";
import { motion } from "framer-motion";
import { Copy, GraduationCap, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TABS: FocusHubTab[] = [
  { id: "stream", label: "Stream" },
  { id: "activities", label: "Activities" },
  { id: "participants", label: "Participants" },
  { id: "monitor", label: "Live Monitor", hostOnly: true },
  { id: "analytics", label: "Analytics" },
];

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<FocusHubRoom | null>(null);
  const [activities, setActivities] = useState<FocusHubActivity[]>([]);
  const [members, setMembers] = useState<Array<{
    user_id: string;
    role: "host" | "participant";
    joined_at: string;
    name: string;
    avatar_url: string | null;
  }>>([]);
  const [role, setRole] = useState<"host" | "participant" | null>(null);
  const [activeTab, setActiveTab] = useState("stream");
  const [createActivityOpen, setCreateActivityOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [r, acts, mems, rl] = await Promise.all([
        getRoomById(roomId),
        getRoomActivities(roomId),
        getRoomMembers(roomId),
        getRoomRole(roomId),
      ]);
      setRoom(r);
      setActivities(acts);
      setMembers(mems);
      setRole(rl);
      setLoading(false);
    })();
  }, [roomId]);

  async function handleStartActivity(activityId: string) {
    try {
      const updated = await startActivity(activityId);
      setActivities((prev) =>
        prev.map((a) => (a.id === activityId ? updated : a)),
      );
    } catch (e) {
      console.error(e);
    }
  }

  async function handleEndActivity(activityId: string) {
    try {
      const updated = await endActivity(activityId);
      setActivities((prev) =>
        prev.map((a) => (a.id === activityId ? updated : a)),
      );
    } catch (e) {
      console.error(e);
    }
  }

  function handleTabChange(tab: string) {
    if (tab === "participants") {
      router.push(`/focus-hub/${roomId}/participants`);
    } else if (tab === "monitor") {
      router.push(`/focus-hub/${roomId}/monitor`);
    } else if (tab === "analytics") {
      router.push(`/focus-hub/${roomId}/analytics`);
    } else {
      setActiveTab(tab);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-24 animate-pulse rounded-2xl border border-[var(--cc-border)] bg-white/5" />
        <div className="h-8 w-64 animate-pulse rounded-xl bg-white/5" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-[var(--cc-border)] bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center text-muted">
        <p className="text-sm">Room not found or you don't have access.</p>
        <Link href="/focus-hub" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to Focus Hub
        </Link>
      </div>
    );
  }

  const isHost = role === "host";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      {/* Room header */}
      <div className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            {room.image_url ? (
              <img src={room.image_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <GraduationCap className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-text">{room.name}</h1>
              {isHost && (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  Host
                </span>
              )}
            </div>
            {room.description && (
              <p className="mt-1 text-sm text-muted">{room.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {members.length} / {room.participant_limit} members
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(room.join_code)}
                className="flex items-center gap-1 rounded-lg border border-[var(--cc-border)] px-2 py-0.5 font-mono font-semibold transition hover:text-text"
              >
                <Copy className="h-3 w-3" />
                {room.join_code}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <FocusHubTabBar
        tabs={TABS}
        active={activeTab}
        isHost={isHost}
        onChange={handleTabChange}
      />

      {/* Tab content */}
      {activeTab === "stream" && (
        <RoomStream roomId={roomId} isHost={isHost} />
      )}

      {activeTab === "activities" && (
        <div className="space-y-4">
          {isHost && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCreateActivityOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white shadow transition hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                New Activity
              </button>
            </div>
          )}
          {activities.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--cc-border)] py-12 text-center text-muted">
              <p className="text-sm">No activities yet.</p>
              {isHost && (
                <button
                  type="button"
                  onClick={() => setCreateActivityOpen(true)}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Create your first activity
                </button>
              )}
            </div>
          ) : (
            activities.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                roomId={roomId}
                isHost={isHost}
                onStart={() => void handleStartActivity(a.id)}
                onEnd={() => void handleEndActivity(a.id)}
              />
            ))
          )}
        </div>
      )}

      <CreateActivitySheet
        open={createActivityOpen}
        roomId={roomId}
        onClose={() => setCreateActivityOpen(false)}
        onCreated={(a) => setActivities((prev) => [a, ...prev])}
      />
    </motion.div>
  );
}
