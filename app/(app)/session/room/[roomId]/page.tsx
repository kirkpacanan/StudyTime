"use client";

import {
  LibraryLoadingScreen,
  StudySessionView,
} from "@/components/session/StudySessionView";
import { RoomMonitoringConsentModal } from "@/components/library-rooms/RoomMonitoringConsentModal";
import {
  getLibraryRoomById,
  getLibraryRoomRole,
  joinPublicLibraryRoom,
  leaveLibraryRoom,
} from "@/lib/library-rooms";
import type { LibraryRoom } from "@/lib/library-rooms";
import { hasRoomMonitoringConsent } from "@/lib/room-monitoring";
import { motion } from "framer-motion";
import { Hash, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PrivateLibraryRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<LibraryRoom | null>(null);
  const [role, setRole] = useState<"host" | "participant" | null>(null);
  const [status, setStatus] = useState<
    "loading" | "denied" | "join" | "consent" | "ready"
  >("loading");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [monitoringConsented, setMonitoringConsented] = useState(false);

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

      if (memberRole) {
        setRoom(r);
        setRole(memberRole);
        if (memberRole === "host") {
          setMonitoringConsented(true);
          setStatus("ready");
          return;
        }
        const consented = await hasRoomMonitoringConsent(roomId);
        if (cancelled) return;
        setMonitoringConsented(consented);
        setStatus(consented ? "ready" : "consent");
        return;
      }

      if (r.is_private) {
        router.replace(`/session/join?code=${encodeURIComponent(r.join_code)}`);
        return;
      }

      setRoom(r);
      setStatus("join");
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, router]);

  async function handlePublicJoin() {
    if (!room) return;
    setJoinErr(null);
    setJoinBusy(true);
    try {
      await joinPublicLibraryRoom(room.id);
      const memberRole = await getLibraryRoomRole(room.id);
      setRole(memberRole ?? "participant");
      setMonitoringConsented(false);
      setStatus("consent");
    } catch (err) {
      setJoinErr(err instanceof Error ? err.message : "Could not join room.");
    } finally {
      setJoinBusy(false);
    }
  }

  async function handleDeclineConsent() {
    try {
      await leaveLibraryRoom(roomId);
    } catch {
      /* ignore */
    }
    router.push("/session");
  }

  if (status === "loading") {
    return <LibraryLoadingScreen embedded />;
  }

  if (status === "denied" || !room) {
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

  if (status === "join") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-16 text-center"
      >
        <div className="game-lite-icon !h-12 !w-12 !rounded-xl">
          <Users className="h-6 w-6 text-sky-200" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">{room.name}</h1>
          {room.description ? (
            <p className="mt-2 text-sm text-muted">{room.description}</p>
          ) : null}
          <p className="mt-3 text-xs text-muted">
            Public study room · up to {room.participant_limit} seats
          </p>
        </div>
        {joinErr ? (
          <p className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {joinErr}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void handlePublicJoin()}
          disabled={joinBusy}
          className="game-lite-btn-sky w-full max-w-xs disabled:opacity-50"
        >
          {joinBusy ? "Joining…" : "Join room"}
        </button>
        <Link href="/session" className="text-sm text-muted transition hover:text-text">
          Back to library lobby
        </Link>
      </motion.div>
    );
  }

  if (status === "consent" && role === "participant") {
    return (
      <RoomMonitoringConsentModal
        roomId={roomId}
        roomName={room.name}
        onAccepted={() => {
          setMonitoringConsented(true);
          setStatus("ready");
        }}
        onDecline={() => void handleDeclineConsent()}
      />
    );
  }

  if (!role) {
    return <LibraryLoadingScreen embedded />;
  }

  return (
    <StudySessionView
      libraryRoomId={room.id}
      libraryRoomName={room.name}
      libraryRoomRole={role}
      libraryRoomParticipantLimit={room.participant_limit}
      joinCode={room.join_code}
      monitoringConsented={monitoringConsented}
    />
  );
}
