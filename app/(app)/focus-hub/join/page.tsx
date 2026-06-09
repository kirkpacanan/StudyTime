"use client";

import { joinRoom } from "@/lib/focus-hub/client";
import { motion } from "framer-motion";
import { Hash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinRoomPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setErr(null);
    setLoading(true);
    try {
      const room = await joinRoom(code);
      router.push(`/focus-hub/${room.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Invalid room code.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-8"
      >
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Hash className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-text">Join a Room</h1>
          <p className="text-sm text-muted">
            Enter the 6-character code shared by your host.
          </p>
        </div>

        <form onSubmit={(e) => void handleJoin(e)} className="space-y-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            className="w-full rounded-xl border border-[var(--cc-border)] bg-white/5 px-4 py-3 text-center font-mono text-2xl font-bold uppercase tracking-[0.3em] text-text placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            required
          />
          {err && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center text-xs text-red-400">
              {err}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || code.length < 4}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Joining…" : "Join Room"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
