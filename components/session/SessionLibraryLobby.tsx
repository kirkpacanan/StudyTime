"use client";

import { CreateLibraryRoomSheet } from "@/components/library-rooms/CreateLibraryRoomSheet";
import {
  LibraryRoomConfirmModal,
  type LibraryRoomAction,
} from "@/components/library-rooms/LibraryRoomConfirmModal";
import { LibraryRoomCard } from "@/components/library-rooms/LibraryRoomCard";
import {
  acceptActivityRoomInvite,
  archiveLibraryRoom,
  getMyActivityRoomInvites,
  getMyLibraryRooms,
  isActivityRoom,
  joinLibraryRoom,
  leaveLibraryRoom,
} from "@/lib/library-rooms";
import type {
  LibraryRoom,
  LibraryRoomWithRole,
  PendingActivityRoomInvite,
} from "@/lib/library-rooms";
import { motion } from "framer-motion";
import { Activity, BookOpen, ChevronRight, Globe, Hash, Mail, Plus } from "lucide-react";
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
  const [pendingInvites, setPendingInvites] = useState<PendingActivityRoomInvite[]>([]);
  const [inviteAcceptId, setInviteAcceptId] = useState<string | null>(null);

  const canJoin = joinCode.trim().length >= 4 && !joinLoading;

  const activityRooms = rooms.filter((r) => isActivityRoom(r));

  const refreshRooms = useCallback(async () => {
    const [mine, invites] = await Promise.all([
      getMyLibraryRooms(),
      getMyActivityRoomInvites(),
    ]);
    setRooms(mine);
    setPendingInvites(invites);
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
      setJoinErr(
        err instanceof Error ? err.message : "Invalid activity room code.",
      );
      setJoinLoading(false);
    }
  }

  async function handleAcceptInvite(roomId: string) {
    setInviteAcceptId(roomId);
    try {
      await acceptActivityRoomInvite(roomId);
      router.push(`/session/room/${roomId}`);
    } catch (err) {
      setJoinErr(err instanceof Error ? err.message : "Could not accept invite.");
      setInviteAcceptId(null);
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
                Study openly in the Main Library, or join an activity room with a code or email
                invite.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="game-lite-btn-gold shrink-0 self-center sm:self-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              Activity room
            </button>
          </div>

          <div className="mt-3 space-y-4">
            <section className="game-lite-enter-panel">
              <div className="mb-1 flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-sky-400/70" />
                <h2 className="game-lite-label">Open study</h2>
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
                    The public study space — open to everyone, no invite needed
                  </p>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-sky-300/70 transition group-hover:translate-x-0.5" />
              </button>

              <div className="pt-1">
                <p className="game-lite-label mb-2">Or join activity room with code</p>
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

            {pendingInvites.length > 0 ? (
              <section className="game-lite-enter-panel border-violet-500/20">
                <div className="mb-2 flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-violet-300" />
                  <h2 className="game-lite-label">Activity room invites</h2>
                </div>
                <div className="space-y-2">
                  {pendingInvites.map((inv) => (
                    <div
                      key={inv.invite_id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{inv.room_name}</p>
                        <p className="text-[10px] text-violet-200/60">Host analytics & monitoring</p>
                      </div>
                      <button
                        type="button"
                        disabled={inviteAcceptId != null}
                        onClick={() => void handleAcceptInvite(inv.room_id)}
                        className="game-lite-btn-gold shrink-0 !px-3 !py-1.5 !text-xs disabled:opacity-50"
                      >
                        {inviteAcceptId === inv.room_id ? "…" : "Accept"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

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
                <Activity className="h-3.5 w-3.5 text-violet-300/80" />
                <h2 className="game-lite-label">My activity rooms</h2>
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
              ) : activityRooms.length === 0 ? (
                <p className="game-lite-inset justify-center py-6 text-center text-xs text-sky-200/50">
                  No activity rooms yet. Create one or join with a code or email invite.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {activityRooms.map((room) => (
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
