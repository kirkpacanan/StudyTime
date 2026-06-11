"use client";

import { createLibraryRoom } from "@/lib/library-rooms";
import type { LibraryRoom } from "@/lib/library-rooms";
import {
  clampParticipantLimit,
  MAX_LIBRARY_PARTICIPANTS,
  MIN_LIBRARY_PARTICIPANTS,
} from "@/lib/library/seats";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookOpen, Lock, Unlock, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CATEGORIES = ["Education", "Business", "Training", "Meeting", "Other"];
const SHEET_SPRING = { type: "spring" as const, stiffness: 320, damping: 34 };

const PRIVACY_OPTIONS = [
  {
    value: false,
    label: "Public",
    icon: Unlock,
    helper: "Listed in the lobby — anyone can browse and join.",
  },
  {
    value: true,
    label: "Private",
    icon: Lock,
    helper: "Hidden from the lobby — share your room code to invite others.",
  },
] as const;

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
  const reduce = useReducedMotion();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("10");
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const seatCountPreview = useMemo(() => {
    const n = parseInt(limit, 10);
    if (limit === "" || Number.isNaN(n)) return MIN_LIBRARY_PARTICIPANTS;
    if (n > MAX_LIBRARY_PARTICIPANTS) return MAX_LIBRARY_PARTICIPANTS;
    return n;
  }, [limit]);

  const displayName = name.trim() || "Your study room";
  const displayCategory = category
    ? category.charAt(0).toUpperCase() + category.slice(1)
    : "Uncategorized";

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, loading, onClose]);

  function handleLimitChange(raw: string) {
    if (raw === "") {
      setLimit("");
      return;
    }
    if (!/^\d+$/.test(raw)) return;
    const n = parseInt(raw, 10);
    if (n > MAX_LIBRARY_PARTICIPANTS) {
      setLimit(String(MAX_LIBRARY_PARTICIPANTS));
      return;
    }
    setLimit(raw);
  }

  function commitLimit() {
    if (limit === "") {
      setLimit(String(MIN_LIBRARY_PARTICIPANTS));
      return;
    }
    const n = parseInt(limit, 10);
    if (Number.isNaN(n)) {
      setLimit(String(MIN_LIBRARY_PARTICIPANTS));
      return;
    }
    setLimit(String(clampParticipantLimit(n)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setErr(null);
    setLoading(true);
    const finalLimit = clampParticipantLimit(parseInt(limit, 10) || MIN_LIBRARY_PARTICIPANTS);
    try {
      const room = await createLibraryRoom({
        name: name.trim(),
        description: description.trim() || undefined,
        category: category || undefined,
        participant_limit: finalLimit,
        is_private: isPrivate,
      });
      onCreated(room);
      onClose();
      setName("");
      setDescription("");
      setCategory("");
      setLimit("10");
      setIsPrivate(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create room.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "game-lite-inset w-full !min-h-[2.5rem] text-sm text-white placeholder:text-sky-200/40 focus-within:ring-2 focus-within:ring-sky-500/30";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="create-library-room-overlay"
            type="button"
            aria-label="Close create room"
            className="absolute inset-0 z-[30] border-0 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={loading ? undefined : onClose}
          />

          <motion.aside
            key="create-library-room-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-library-room-title"
            className="game-lite-sheet absolute inset-y-3 right-0 z-[40] flex w-full max-w-md flex-col overflow-hidden rounded-l-xl shadow-2xl"
            initial={reduce ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={reduce ? { duration: 0.01 } : SHEET_SPRING}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-5 py-3">
              <div className="flex items-center gap-2">
                <div className="game-lite-icon !h-8 !w-8 !rounded-lg">
                  <BookOpen className="h-4 w-4 text-sky-200" />
                </div>
                <h2 id="create-library-room-title" className="text-sm font-bold text-white">
                  Create Study Room
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg p-1.5 text-sky-200/60 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="shrink-0 space-y-3 overflow-y-auto px-5 py-4">
                <div>
                  <label className="game-lite-label mb-1 block">
                    Room Name <span className="text-red-400">*</span>
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
                  <label className="game-lite-label mb-1 block">Description</label>
                  <textarea
                    className={inputCls + " !min-h-[3.25rem] !items-start resize-none py-2"}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Who studies here?"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="game-lite-label mb-1 block">Category</label>
                    <select
                      className={inputCls + " appearance-none"}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="" className="bg-[#152238]">
                        Select…
                      </option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c.toLowerCase()} className="bg-[#152238]">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="game-lite-label mb-1 block">Seats</label>
                    <input
                      type="number"
                      min={MIN_LIBRARY_PARTICIPANTS}
                      max={MAX_LIBRARY_PARTICIPANTS}
                      className={inputCls}
                      value={limit}
                      onChange={(e) => handleLimitChange(e.target.value)}
                      onBlur={commitLimit}
                    />
                    <p className="mt-1 text-[10px] text-sky-200/45">
                      Up to {MAX_LIBRARY_PARTICIPANTS} seats in the library layout
                    </p>
                  </div>
                </div>

                <div>
                  <label className="game-lite-label mb-1.5 block">Privacy</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIVACY_OPTIONS.map(({ value, label, icon: Icon, helper }) => {
                      const selected = isPrivate === value;
                      return (
                        <button
                          key={String(value)}
                          type="button"
                          onClick={() => setIsPrivate(value)}
                          className={
                            "rounded-xl border p-2.5 text-left transition " +
                            (selected
                              ? "border-sky-500/50 bg-sky-500/10"
                              : "border-[#1a3050] bg-black/20 hover:border-sky-600/30")
                          }
                        >
                          <div className="flex items-center gap-1.5">
                            <Icon
                              className={
                                "h-3.5 w-3.5 " +
                                (selected ? "text-sky-300" : "text-sky-200/50")
                              }
                            />
                            <span
                              className={
                                "text-xs font-bold " +
                                (selected ? "text-white" : "text-sky-200/70")
                              }
                            >
                              {label}
                            </span>
                          </div>
                          <p className="mt-1 pl-5 text-[10px] leading-snug text-sky-200/50">
                            {helper}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {err ? (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">
                    {err}
                  </p>
                ) : null}
              </div>

              <div className="flex min-h-0 flex-1 flex-col justify-end px-5 pb-4">
                <div className="game-lite-enter-panel !space-y-2">
                  <p className="game-lite-label">Room preview</p>
                  <div className="flex items-start gap-3">
                    <div className="game-lite-icon !h-10 !w-10 shrink-0">
                      <BookOpen className="h-4 w-4 text-sky-200" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-bold text-white">{displayName}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-sky-200/55">
                        {description.trim() || "Add a short description for your room."}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="game-lite-badge game-lite-badge-sky">{displayCategory}</span>
                        <span
                          className={
                            isPrivate
                              ? "game-lite-badge border-slate-500/40 bg-slate-500/15 text-slate-300"
                              : "game-lite-badge border-emerald-500/35 bg-emerald-500/12 text-emerald-300"
                          }
                        >
                          {isPrivate ? (
                            <>
                              <Lock className="h-2.5 w-2.5" />
                              Private
                            </>
                          ) : (
                            <>
                              <Unlock className="h-2.5 w-2.5" />
                              Public
                            </>
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300/70">
                          <Users className="h-3.5 w-3.5" />
                          1 / {seatCountPreview}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] leading-relaxed text-sky-200/45">
                    {isPrivate
                      ? "You'll receive a join code to share after creating this room."
                      : "This room will appear in Public study rooms for anyone to join."}
                  </p>
                </div>
              </div>

              <div className="shrink-0 border-t border-white/[0.08] bg-[#0f1a2a]/90 px-5 py-4">
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="game-lite-btn-sky w-full !min-h-[2.5rem] disabled:opacity-50"
                >
                  {loading ? "Creating…" : "Create Room"}
                </button>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
