"use client";

import {
  LibraryLoadingScreen,
  StudySessionView,
} from "@/components/session/StudySessionView";
import { RoomMonitoringConsentModal } from "@/components/library-rooms/RoomMonitoringConsentModal";
import {
  acceptActivityRoomInvite,
  getLibraryRoomById,
  getLibraryRoomRole,
  hasPendingActivityRoomInvite,
  isActivityRoom,
  leaveLibraryRoom,
} from "@/lib/library-rooms";
import type { LibraryRoom } from "@/lib/library-rooms";
import { hasRoomMonitoringConsent } from "@/lib/room-monitoring";
import { motion } from "framer-motion";
import { Activity, Mail } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ActivityRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<LibraryRoom | null>(null);
  const [role, setRole] = useState<"host" | "participant" | null>(null);
  const [status, setStatus] = useState<
    "loading" | "denied" | "invite" | "consent" | "ready"
  >("loading");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [monitoringConsented, setMonitoringConsented] = useState(false);
  const [screenCaptureGranted, setScreenCaptureGranted] = useState(false);
  const [hasInvite, setHasInvite] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [r, memberRole] = await Promise.all([
        getLibraryRoomById(roomId),
        getLibraryRoomRole(roomId),
      ]);
      if (cancelled) return;

      if (!r || r.archived_at || !isActivityRoom(r)) {
        setStatus("denied");
        return;
      }

      setRoom(r);

      if (memberRole) {
        setRole(memberRole);
        if (memberRole === "host") {
          setMonitoringConsented(true);
          setScreenCaptureGranted(true);
          setStatus("ready");
          return;
        }
        const consented = await hasRoomMonitoringConsent(roomId);
        if (cancelled) return;
        setMonitoringConsented(consented);
        setStatus(consented ? "ready" : "consent");
        return;
      }

      const invited = await hasPendingActivityRoomInvite(roomId);
      if (cancelled) return;
      setHasInvite(invited);
      setStatus(invited ? "invite" : "denied");
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  async function handleAcceptInvite() {
    if (!room) return;
    setJoinErr(null);
    setJoinBusy(true);
    try {
      await acceptActivityRoomInvite(room.id);
      setRole("participant");
      setMonitoringConsented(false);
      setStatus("consent");
    } catch (err) {
      setJoinErr(err instanceof Error ? err.message : "Could not accept invite.");
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
          <Activity className="h-6 w-6 text-violet-400" />
        </div>
        <h1 className="text-xl font-bold text-text">Invite required</h1>
        <p className="text-sm text-muted">
          Activity rooms are invite-only. Ask the host for an email invite or join code. To study
          openly, use the Main Library.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/session/join"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Join with code
          </Link>
          <Link
            href="/session"
            className="rounded-xl border border-[var(--cc-border)] bg-white/5 px-4 py-2 text-sm font-medium text-text"
          >
            Back to lobby
          </Link>
        </div>
      </motion.div>
    );
  }

  if (status === "invite" && hasInvite) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-16 text-center"
      >
        <div className="game-lite-icon !h-12 !w-12 !rounded-xl">
          <Mail className="h-6 w-6 text-sky-200" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">You&apos;re invited</h1>
          <p className="mt-2 text-sm text-muted">
            Join <strong className="text-text">{room.name}</strong> — an activity room with host
            analytics and monitoring.
          </p>
        </div>
        {joinErr ? (
          <p className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {joinErr}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void handleAcceptInvite()}
          disabled={joinBusy}
          className="game-lite-btn-gold w-full max-w-xs disabled:opacity-50"
        >
          {joinBusy ? "Joining…" : "Accept invite & continue"}
        </button>
        <Link href="/session" className="text-sm text-muted transition hover:text-text">
          Back to lobby
        </Link>
      </motion.div>
    );
  }

  if (status === "consent" && role === "participant") {
    return (
      <RoomMonitoringConsentModal
        roomId={roomId}
        roomName={room.name}
        onAccepted={(screenGranted) => {
          setMonitoringConsented(true);
          setScreenCaptureGranted(screenGranted);
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
      screenCaptureGranted={screenCaptureGranted}
      isActivityRoom
    />
  );
}
