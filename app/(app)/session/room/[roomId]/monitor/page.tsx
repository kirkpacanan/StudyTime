"use client";

import { LiveFocusGrid } from "@/components/focus-hub/LiveFocusGrid";
import { useHostLibraryRoom } from "@/hooks/useHostLibraryRoom";
import { getLibraryRoomById, getLibraryRoomRole } from "@/lib/library-rooms";
import type { LibraryRoom } from "@/lib/library-rooms";
import { motion } from "framer-motion";
import { ArrowLeft, Monitor } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LibraryRoomMonitorPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<LibraryRoom | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const { participants, flaggedCount, avgScore } = useHostLibraryRoom(
    authorized ? roomId : "",
  );

  useEffect(() => {
    void (async () => {
      const [r, role] = await Promise.all([
        getLibraryRoomById(roomId),
        getLibraryRoomRole(roomId),
      ]);
      if (!r || role !== "host") {
        router.replace(`/session/room/${roomId}`);
        return;
      }
      setRoom(r);
      setAuthorized(true);
      setLoading(false);
    })();
  }, [roomId, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-white/5" />
        <div className="h-64 animate-pulse rounded-2xl border border-[var(--cc-border)] bg-white/5" />
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/session/room/${roomId}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--cc-border)] bg-white/5 text-muted transition hover:text-text"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-cyan-400" />
              <h1 className="text-xl font-bold text-text">Live Monitor</h1>
            </div>
            <p className="text-sm text-muted">{room?.name}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3 py-2 font-mono text-sm font-semibold text-muted">
          Code: {room?.join_code}
        </div>
      </div>

      <LiveFocusGrid
        participants={participants}
        avgScore={avgScore}
        flaggedCount={flaggedCount}
      />
    </motion.div>
  );
}
