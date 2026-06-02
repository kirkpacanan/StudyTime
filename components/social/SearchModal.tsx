"use client";

import { Input } from "@/components/ui/input";
import { searchUsers } from "@/lib/social/profile-service";
import { sendFriendRequest } from "@/lib/social/friends-service";
import { profileHref, type UserSearchResult } from "@/lib/social/types";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Search, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { UserAvatar } from "./UserAvatar";

export function SearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSent({});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await searchUsers(term);
      if (!cancelled) {
        setResults(res);
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleAdd(userId: string) {
    setSent((s) => ({ ...s, [userId]: true }));
    const res = await sendFriendRequest(userId);
    if (!res.ok) setSent((s) => ({ ...s, [userId]: false }));
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-card w-full max-w-lg overflow-hidden p-0"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[var(--cc-border)] px-4 py-3">
              <Search className="h-4 w-4 text-muted" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, @username, or ST-UID"
                className="border-0 bg-transparent px-0 py-1 focus:ring-0"
              />
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted hover:bg-white/40 dark:hover:bg-white/10"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {loading ? (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  Searching…
                </p>
              ) : query.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  Type at least 2 characters to find study partners.
                </p>
              ) : results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  No users found.
                </p>
              ) : (
                <ul className="space-y-1">
                  {results.map((u) => (
                    <li
                      key={u.userId}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/30 dark:hover:bg-white/[0.06]"
                    >
                      <Link
                        href={profileHref(u)}
                        onClick={onClose}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <UserAvatar
                          userId={u.userId}
                          displayName={u.displayName}
                          avatarId={u.avatarId}
                          frameId={u.frameId}
                          size={40}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text">
                            {u.displayName}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {u.username ? `@${u.username}` : u.publicUid} · Lv{" "}
                            {u.level}
                          </p>
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleAdd(u.userId)}
                        disabled={sent[u.userId]}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-300"
                      >
                        {sent[u.userId] ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> Sent
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3.5 w-3.5" /> Add
                          </>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
