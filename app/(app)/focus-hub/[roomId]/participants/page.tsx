"use client";

import { getRoomMembers, getRoomRole, removeParticipant } from "@/lib/focus-hub/client";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Member = {
  user_id: string;
  role: "host" | "participant";
  joined_at: string;
  name: string;
  avatar_url: string | null;
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function ParticipantsPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<"host" | "participant" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [mems, role] = await Promise.all([
        getRoomMembers(roomId),
        getRoomRole(roomId),
      ]);
      setMembers(mems);
      setMyRole(role);
      setLoading(false);
    })();
  }, [roomId]);

  async function handleRemove(userId: string) {
    await removeParticipant(roomId, userId);
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36 }}
      className="mx-auto max-w-2xl space-y-6"
    >
      <div className="flex items-center gap-3">
        <Link
          href={`/focus-hub/${roomId}`}
          className="rounded-xl border border-[var(--cc-border)] p-2 text-muted transition hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-text">Participants</h1>
          <p className="text-xs text-muted">{members.length} members</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-[var(--cc-border)] bg-white/5" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted">
          <Users className="h-10 w-10 opacity-40" />
          <p className="text-sm">No participants yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center justify-between rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {m.avatar_url ? (
                  <img
                    src={m.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    {initials(m.name)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-text">{m.name}</p>
                  <p className="text-xs text-muted capitalize">{m.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.role === "host" && (
                  <Crown className="h-4 w-4 text-amber-400" />
                )}
                {myRole === "host" && m.role !== "host" && (
                  <button
                    type="button"
                    onClick={() => void handleRemove(m.user_id)}
                    className="rounded-lg p-1.5 text-muted transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
