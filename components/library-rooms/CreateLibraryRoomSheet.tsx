"use client";

import { createLibraryRoom } from "@/lib/library-rooms";
import type { LibraryRoom } from "@/lib/library-rooms";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Lock, Unlock, X } from "lucide-react";
import { useState } from "react";

const CATEGORIES = ["Education", "Business", "Training", "Meeting", "Other"];

type CreateLibraryRoomSheetProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (room: LibraryRoom) => void;
};

export function CreateLibraryRoomSheet({
  open,
  onClose,
  onCreated,
}: CreateLibraryRoomSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("50");
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setErr(null);
    setLoading(true);
    try {
      const room = await createLibraryRoom({
        name: name.trim(),
        description: description.trim() || undefined,
        category: category || undefined,
        participant_limit: Math.max(2, parseInt(limit, 10) || 50),
        is_private: isPrivate,
      });
      onCreated(room);
      onClose();
      setName("");
      setDescription("");
      setCategory("");
      setLimit("50");
      setIsPrivate(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create room.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-[var(--cc-border)] bg-white/5 px-3 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-[var(--cc-bg)] shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between border-b border-[var(--cc-border)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-text">Create Study Room</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted transition hover:bg-white/10 hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6"
            >
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Room Name <span className="text-alert">*</span>
                </label>
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Study Group, CS 101"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Description
                </label>
                <textarea
                  className={inputCls + " min-h-[4rem] resize-none"}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Who studies here?"
                  rows={3}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Category
                </label>
                <select
                  className={inputCls}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Select category…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c.toLowerCase()}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Participant Limit
                </label>
                <input
                  type="number"
                  min={2}
                  max={200}
                  className={inputCls}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Privacy
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[false, true].map((priv) => (
                    <button
                      key={String(priv)}
                      type="button"
                      onClick={() => setIsPrivate(priv)}
                      className={
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition " +
                        (isPrivate === priv
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-[var(--cc-border)] bg-white/5 text-muted hover:text-text")
                      }
                    >
                      {priv ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      {priv ? "Private" : "Invite only"}
                    </button>
                  ))}
                </div>
              </div>

              {err && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  {err}
                </p>
              )}

              <div className="mt-auto pt-4">
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? "Creating…" : "Create Room"}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
