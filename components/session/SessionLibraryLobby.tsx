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
  getPublicLibraryRooms,
  joinLibraryRoom,
  joinPublicLibraryRoom,
  leaveLibraryRoom,
} from "@/lib/library-rooms";
import type {
  LibraryRoom,
  LibraryRoomWithRole,
  PublicLibraryRoom,
} from "@/lib/library-rooms";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, Globe, Hash, Plus, Unlock, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type SessionLibraryLobbyProps = {
  onSelectMain: () => void;
};

export function SessionLibraryLobby({ onSelectMain }: SessionLibraryLobbyProps) {
  const router = useRouter();
  const [rooms, setRooms] = useState<LibraryRoomWithRole[]>([]);
  const [publicRooms, setPublicRooms] = useState<PublicLibraryRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicJoinId, setPublicJoinId] = useState<string | null>(null);
  const [publicJoinErr, setPublicJoinErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [roomAction, setRoomAction] = useState<LibraryRoomAction | null>(null);
  const [roomTarget, setRoomTarget] = useState<LibraryRoomWithRole | null>(null);
  const [roomActionBusy, setRoomActionBusy] = useState(false);
  const [roomActionErr, setRoomActionErr] = useState<string | null>(null);
  const [roomActionSuccess, setRoomActionSuccess] = useState<string | null>(null);

  const canJoin = joinCode.trim().length >= 4 && !joinLoading;

  const refreshRooms = useCallback(async () => {
    const [mine, listed] = await Promise.all([
      getMyLibraryRooms(),
      getPublicLibraryRooms(),
    ]);
    setRooms(mine);
    setPublicRooms(listed);
    setLoading(false);
    setPublicLoading(false);
  }, []);

  useEffect(() => {
    void refreshRooms();
  }, [refreshRooms]);

  function handleRoomCreated(room: LibraryRoom) {
    router.push(`/session/room/${room.id}`);
  }

  async function handleEnterPublic(room: PublicLibraryRoom) {
    setPublicJoinErr(null);
    setPublicJoinId(room.id);
    try {
      await joinPublicLibraryRoom(room.id);
      router.push(`/session/room/${room.id}`);
    } catch (err) {
      setPublicJoinErr(
        err instanceof Error ? err.message : "Could not join room.",
      );
      setPublicJoinId(null);
    }
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
      className="absolute inset-0 z-[200] flex items-center justify-center overflow-x-hidden overflow-y-auto bg-black/55 px-3 py-5 backdrop-blur-sm sm:px-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="game-lite-modal game-lite-modal-lobby relative my-auto w-full max-w-xl px-4 pb-4 sm:px-5 sm:pb-5"
      >
        <div className="game-lite-ribbon">Choose Library</div>

        <div className="game-lite-modal-lobby-body">
          <div className="game-lite-header-panel">
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-sm font-bold text-white/95">Where do you want to study?</p>
            <p className="mt-1 text-xs leading-relaxed text-sky-200/60">
              Main Library, browse public rooms, or join a private room with a code.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="game-lite-btn-gold shrink-0 self-center sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Create room
          </button>
        </div>

        <div className="mt-3 space-y-4">
          <section className="game-lite-enter-panel">
            <div className="mb-1 flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-sky-400/70" />
              <h2 className="game-lite-label">Enter a library</h2>
            </div>

            <button
              type="button"
              onClick={onSelectMain}
              className="game-lite-tile group"
            >
              <span className="game-lite-icon">
                <Globe className="h-5 w-5 text-sky-200" />
              </span>
              <span className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">Main Library</p>
                <p className="mt-1 text-xs leading-relaxed text-sky-200/55">
                  Public shared space — study alongside everyone
                </p>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-sky-300/70 transition group-hover:translate-x-0.5" />
            </button>

            <div className="pt-1">
              <p className="game-lite-label mb-2">Or join with code</p>
              <form onSubmit={(e) => void handleJoin(e)} className="flex gap-3">
                <div className="game-lite-inset">
                  <Hash className="h-4 w-4 shrink-0 text-sky-400/60" />
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Join with code"
                    maxLength={6}
                    className="min-w-0 flex-1 border-0 bg-transparent py-2 font-mono text-sm font-semibold uppercase tracking-widest text-white outline-none placeholder:text-sky-200/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!canJoin}
                  className="game-lite-btn-sky"
                >
                  {joinLoading ? "…" : "Join"}
                </button>
              </form>
              {joinErr ? (
                <p className="mt-2 text-center text-xs font-medium text-red-300 sm:text-left">
                  {joinErr}
                </p>
              ) : null}
            </div>
          </section>

          {roomActionSuccess ? (
            <p
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-300"
              role="status"
            >
              {roomActionSuccess}
            </p>
          ) : null}

          <div className="border-t border-white/[0.08] pt-4">
            <div className="mb-3 flex items-center gap-2">
              <Unlock className="h-3.5 w-3.5 text-sky-400/70" />
              <h2 className="game-lite-label">Public study rooms</h2>
            </div>

            {publicJoinErr ? (
              <p className="mb-3 text-center text-xs font-medium text-red-300">
                {publicJoinErr}
              </p>
            ) : null}

            {publicLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[...Array(2)].map((_, i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-xl border-2 border-[#1a3050] bg-[#152238]/60"
                  />
                ))}
              </div>
            ) : publicRooms.length === 0 ? (
              <p className="game-lite-inset justify-center py-5 text-center text-xs text-sky-200/50">
                No public rooms yet — create one or use a code.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {publicRooms.map((room) => {
                  const full = room.member_count >= room.participant_limit;
                  const joining = publicJoinId === room.id;
                  return (
                    <div key={room.id} className="game-lite-room-card !p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-bold text-white">
                            {room.name}
                          </p>
                          {room.category ? (
                            <span className="game-lite-badge game-lite-badge-sky mt-1.5 capitalize">
                              {room.category}
                            </span>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-sky-300/60">
                          {room.member_count}/{room.participant_limit}
                        </span>
                      </div>
                      {room.description ? (
                        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-sky-200/50">
                          {room.description}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={full || joining || publicJoinId != null}
                        onClick={() => void handleEnterPublic(room)}
                        className="game-lite-btn-sky mt-3 w-full !min-h-[2.25rem] !px-3 !py-1.5 !text-xs disabled:opacity-40"
                      >
                        {joining ? "Joining…" : full ? "Room full" : "Enter"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.08] pt-4">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-sky-400/70" />
              <h2 className="game-lite-label">My study rooms</h2>
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[...Array(2)].map((_, i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-xl border-2 border-[#1a3050] bg-[#152238]/60"
                  />
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <p className="game-lite-inset justify-center py-6 text-center text-xs text-sky-200/50">
                No rooms yet. Create one or join with a code.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
        </div>
        </div>
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
