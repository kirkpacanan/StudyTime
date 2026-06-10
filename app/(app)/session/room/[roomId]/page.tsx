"use client";

import {
  LibraryLoadingScreen,
  StudySessionView,
} from "@/components/session/StudySessionView";
import { getLibraryRoomById, getLibraryRoomRole } from "@/lib/library-rooms";
import type { LibraryRoom } from "@/lib/library-rooms";
import { motion } from "framer-motion";
import { Hash } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PrivateLibraryRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<LibraryRoom | null>(null);
  const [role, setRole] = useState<"host" | "participant" | null>(null);
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [r, memberRole] = await Promise.all([
        getLibraryRoomById(roomId),
        getLibraryRoomRole(roomId),
      ]);
      if (cancelled) return;

      if (!r || r.archived_at) {
        setStatus("denied");
        return;
      }

      if (!memberRole) {
        router.replace(`/session/join?code=${encodeURIComponent(r.join_code)}`);
        return;
      }

      setRoom(r);
      setRole(memberRole);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, router]);

  if (status === "loading") {
    return <LibraryLoadingScreen embedded />;
  }

  if (status === "denied" || !room || !role) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10">
          <Hash className="h-6 w-6 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-text">Room unavailable</h1>
        <p className="text-sm text-muted">
          This room does not exist or has been archived.
        </p>
        <div className="flex gap-2">
          <Link
            href="/session"
            className="rounded-xl border border-[var(--cc-border)] bg-white/5 px-4 py-2 text-sm font-medium text-text"
          >
            All libraries
          </Link>
          <Link
            href="/session"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Main Library
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <StudySessionView
      libraryRoomId={room.id}
      libraryRoomName={room.name}
      libraryRoomRole={role}
      joinCode={room.join_code}
    />
  );
}
