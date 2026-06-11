"use client";

import {
  getRoomEmailInvites,
  inviteToActivityRoom,
  revokeRoomEmailInvite,
  type RoomEmailInvite,
} from "@/lib/library-rooms";
import { Mail, UserMinus, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ActivityRoomInvitePanelProps = {
  roomId: string;
  open: boolean;
  onClose: () => void;
};

export function ActivityRoomInvitePanel({
  roomId,
  open,
  onClose,
}: ActivityRoomInvitePanelProps) {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<RoomEmailInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    try {
      const rows = await getRoomEmailInvites(roomId);
      setInvites(rows);
    } catch {
      setInvites([]);
    }
  }, [roomId]);

  useEffect(() => {
    if (!open) return;
    void loadInvites();
  }, [open, loadInvites]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setErr(null);
    setLoading(true);
    try {
      await inviteToActivityRoom(roomId, email);
      setEmail("");
      await loadInvites();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send invite.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    setErr(null);
    try {
      await revokeRoomEmailInvite(inviteId);
      await loadInvites();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not revoke invite.");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="game-lite-modal w-full max-w-md p-5" role="dialog">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-sky-300" />
            <h2 className="text-sm font-bold text-white">Invite participants</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-sky-200/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-sky-200/60">
          Only invited emails and users with your join code can enter this activity room.
        </p>

        <form onSubmit={(e) => void handleInvite(e)} className="mb-4 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@school.edu"
            className="game-lite-inset min-w-0 flex-1 text-sm text-white"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="game-lite-btn-sky shrink-0 !px-3 disabled:opacity-50"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite
          </button>
        </form>

        {err ? (
          <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {err}
          </p>
        ) : null}

        <div className="max-h-48 space-y-2 overflow-y-auto">
          {invites.length === 0 ? (
            <p className="text-center text-xs text-sky-200/45">No invites yet.</p>
          ) : (
            invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-white">{inv.email}</p>
                  <p className="text-[10px] capitalize text-sky-200/50">{inv.status}</p>
                </div>
                {inv.status === "pending" ? (
                  <button
                    type="button"
                    onClick={() => void handleRevoke(inv.id)}
                    className="shrink-0 rounded-md p-1 text-red-300/70 hover:bg-red-500/15"
                    aria-label={`Revoke invite for ${inv.email}`}
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
