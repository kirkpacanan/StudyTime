"use client";

import { RoomAnalyticsDashboard } from "@/components/library-rooms/RoomAnalyticsDashboard";
import {
  getLibraryRoomAnalytics,
  getLibraryRoomById,
  getLibraryRoomRole,
  isActivityRoom,
} from "@/lib/library-rooms";
import type { LibraryRoom, LibraryRoomAnalyticsRow } from "@/lib/library-rooms";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LibraryRoomAnalyticsPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<LibraryRoom | null>(null);
  const [rows, setRows] = useState<LibraryRoomAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [r, role] = await Promise.all([
        getLibraryRoomById(roomId),
        getLibraryRoomRole(roomId),
      ]);
      if (!r || role !== "host" || !isActivityRoom(r)) {
        router.replace(`/session/room/${roomId}`);
        return;
      }
      setRoom(r);
      try {
        const analytics = await getLibraryRoomAnalytics(roomId);
        setRows(
          analytics.map((row) => ({
            ...row,
            phone_events: Number(row.phone_events ?? 0),
            drift_events: Number(row.drift_events ?? 0),
            off_screen_events: Number(row.off_screen_events ?? 0),
          })),
        );
      } catch {
        setRows([]);
      }
      setLoading(false);
    })();
  }, [roomId, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-[var(--cc-border)] bg-white/5"
          />
        ))}
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
          href={`/session/room/${roomId}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--cc-border)] bg-white/5 text-muted transition hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-text">Room Analytics</h1>
          </div>
          <p className="text-sm text-muted">{room?.name}</p>
        </div>
      </div>

      <RoomAnalyticsDashboard
        roomId={roomId}
        roomName={room?.name ?? "Study room"}
        rows={rows}
      />
    </motion.div>
  );
}
