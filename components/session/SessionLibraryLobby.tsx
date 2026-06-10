"use client";

import { CreateLibraryRoomSheet } from "@/components/library-rooms/CreateLibraryRoomSheet";
import {
  LibraryRoomConfirmModal,
  type LibraryRoomAction,
} from "@/components/library-rooms/LibraryRoomConfirmModal";
import { LibraryRoomCard } from "@/components/library-rooms/LibraryRoomCard";
import {
  archiveLibraryRoom,
  getMyLibraryRooms,
  joinLibraryRoom,
  leaveLibraryRoom,
} from "@/lib/library-rooms";
import type { LibraryRoom, LibraryRoomWithRole } from "@/lib/library-rooms";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, Globe, Hash, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type SessionLibraryLobbyProps = {
  onSelectMain: () => void;
};

export function SessionLibraryLobby({ onSelectMain }: SessionLibraryLobbyProps) {
  const router = useRouter();
  const [rooms, setRooms] = useState<LibraryRoomWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [roomAction, setRoomAction] = useState<LibraryRoomAction | null>(null);
  const [roomTarget, setRoomTarget] = useState<LibraryRoomWithRole | null>(null);
  const [roomActionBusy, setRoomActionBusy] = useState(false);
  const [roomActionErr, setRoomActionErr] = useState<string | null>(null);
  const [roomActionSuccess, setRoomActionSuccess] = useState<string | null>(null);

  const refreshRooms = useCallback(async () => {
    const r = await getMyLibraryRooms();
    setRooms(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshRooms();
  }, [refreshRooms]);

  function handleRoomCreated(room: LibraryRoom) {
    router.push(`/session/room/${room.id}`);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinErr(null);
    setJoinLoading(true);
    try {
      const room = await joinLibraryRoom(joinCode);
      router.push(`/session/room/${room.id}`);
    } catch (err) {
      setJoinErr(err instanceof Error ? err.message : "Invalid room code.");
      setJoinLoading(false);
    }
  }

  function openRoomAction(action: LibraryRoomAction, room: LibraryRoomWithRole) {
    setRoomActionErr(null);
    setRoomAction(action);
    setRoomTarget(room);
  }

  function closeRoomAction() {
    if (roomActionBusy) return;
    setRoomAction(null);
    setRoomTarget(null);
    setRoomActionErr(null);
  }

  async function confirmRoomAction() {
    if (!roomTarget || !roomAction) return;
    setRoomActionBusy(true);
    setRoomActionErr(null);
    try {
      if (roomAction === "delete") {
        await archiveLibraryRoom(roomTarget.id);
        setRoomActionSuccess(`${roomTarget.name} was deleted.`);
      } else {
        await leaveLibraryRoom(roomTarget.id);
        setRoomActionSuccess(`You left ${roomTarget.name}.`);
      }
      setRoomAction(null);
      setRoomTarget(null);
      setRoomActionErr(null);
      await refreshRooms();
      window.setTimeout(() => setRoomActionSuccess(null), 4000);
    } catch (err) {
      setRoomActionErr(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRoomActionBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm sm:p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="library-glass-panel my-auto w-full max-w-3xl border-amber-500/15 p-5 sm:p-6"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-amber-300" />
              <h1 className="text-lg font-bold text-slate-50 sm:text-xl">
                Choose a library
              </h1>
            </div>
            <p className="text-xs text-slate-400 sm:text-sm">
              Enter the public Main Library or join a private study room.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white shadow transition hover:bg-primary/90 sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            Create room
          </button>
        </div>

        <button
          type="button"
          onClick={onSelectMain}
          className="group mb-5 flex w-full items-center gap-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4 text-left transition hover:border-cyan-400/40 hover:bg-cyan-500/15"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20">
            <Globe className="h-6 w-6 text-cyan-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-50">Main Library</p>
            <p className="text-xs text-slate-400">
              Public shared space — study alongside everyone
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-cyan-400/70 transition group-hover:translate-x-0.5" />
        </button>

        <form
          onSubmit={(e) => void handleJoin(e)}
          className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Join with code"
              maxLength={6}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 font-mono text-sm uppercase tracking-widest text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <button
            type="submit"
            disabled={joinLoading || joinCode.trim().length < 4}
            className="shrink-0 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/15 disabled:opacity-50"
          >
            {joinLoading ? "Joining…" : "Join room"}
          </button>
        </form>
        {joinErr && (
          <p className="-mt-3 mb-4 text-center text-xs text-red-400">{joinErr}</p>
        )}

        {roomActionSuccess ? (
          <p
            className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-300"
            role="status"
          >
            {roomActionSuccess}
          </p>
        ) : null}

        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            My study rooms
          </h2>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5"
              />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-slate-500">
            No private rooms yet. Create one or join with an invite code.
          </p>
        ) : (
          <div className="grid max-h-[min(40vh,320px)] gap-3 overflow-y-auto sm:grid-cols-2">
            {rooms.map((room) => (
              <LibraryRoomCard
                key={room.id}
                room={room}
                onSelect={(id) => router.push(`/session/room/${id}`)}
                onDelete={(r) => openRoomAction("delete", r)}
                onLeave={(r) => openRoomAction("leave", r)}
                variant="lobby"
              />
            ))}
          </div>
        )}
      </motion.div>

      <CreateLibraryRoomSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleRoomCreated}
      />

      <LibraryRoomConfirmModal
        open={roomAction != null && roomTarget != null}
        action={roomAction}
        room={roomTarget}
        busy={roomActionBusy}
        error={roomActionErr}
        onConfirm={() => void confirmRoomAction()}
        onCancel={closeRoomAction}
      />
    </motion.div>
  );
}
