"use client";

import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type StreamPost = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  body: string;
  created_at: string;
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type RoomStreamProps = {
  roomId: string;
  isHost: boolean;
};

export function RoomStream({ roomId, isHost }: RoomStreamProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<StreamPost[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time stream via broadcast channel
  useEffect(() => {
    const sb = getSupabaseBrowser();
    const ch = sb
      .channel(`focus-hub-stream-${roomId}`, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "stream_post" }, ({ payload }) => {
        setPosts((prev) => [...prev, payload as StreamPost]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .subscribe();

    return () => {
      void sb.removeChannel(ch);
    };
  }, [roomId]);

  async function sendPost(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !user) return;
    setSending(true);
    const sb = getSupabaseBrowser();
    const post: StreamPost = {
      id: crypto.randomUUID(),
      author_id: user.id,
      author_name: user.name ?? "User",
      author_avatar: null,
      body: draft.trim(),
      created_at: new Date().toISOString(),
    };
    await sb.channel(`focus-hub-stream-${roomId}`).send({
      type: "broadcast",
      event: "stream_post",
      payload: post,
    });
    setDraft("");
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--cc-border)] py-12 text-center text-sm text-muted">
          No announcements yet.
          {isHost && (
            <p className="mt-1 text-xs">Post an announcement to get started.</p>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {posts.map((post) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4"
          >
            <div className="mb-2 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                {initials(post.author_name)}
              </div>
              <div>
                <p className="text-sm font-semibold text-text">{post.author_name}</p>
                <p className="text-[11px] text-muted">{fmt(post.created_at)}</p>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm text-text/90">{post.body}</p>
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />

      {/* Compose */}
      {(isHost || true) && (
        <form onSubmit={(e) => void sendPost(e)} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isHost ? "Post an announcement…" : "Write a comment…"}
            className="min-h-[2.5rem] flex-1 rounded-xl border border-[var(--cc-border)] bg-white/5 px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow transition hover:bg-primary/90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  );
}
