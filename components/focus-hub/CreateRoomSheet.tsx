"use client";

import { createRoom } from "@/lib/focus-hub/client";
import type { FocusHubRoom } from "@/lib/focus-hub/types";
import {
  clampParticipantLimit,
  MAX_LIBRARY_PARTICIPANTS,
  MIN_LIBRARY_PARTICIPANTS,
} from "@/lib/library/seats";
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, Lock, Unlock, X } from "lucide-react";
import { useMemo, useState } from "react";

const CATEGORIES = ["Education", "Business", "Training", "Meeting", "Other"];

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

type CreateRoomSheetProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (room: FocusHubRoom) => void;
};

export function CreateRoomSheet({ open, onClose, onCreated }: CreateRoomSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("10");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const seatCount = useMemo(
    () => clampParticipantLimit(parseInt(limit, 10) || MIN_LIBRARY_PARTICIPANTS),
    [limit],
  );

  function handleLimitChange(raw: string) {
    if (raw === "") {
      setLimit("");
      return;
    }
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return;
    setLimit(String(clampParticipantLimit(n)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setErr(null);
    setLoading(true);
    try {
      const room = await createRoom({
        name: name.trim(),
        description: description.trim() || undefined,
        category: category || undefined,
        participant_limit: seatCount,
        is_private: isPrivate,
      });
      onCreated(room);
      onClose();
      setName("");
      setDescription("");
      setCategory("");
      setLimit("10");
      setIsPrivate(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create room.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "game-lite-inset w-full !min-h-[2.75rem] text-sm text-white placeholder:text-sky-200/40 focus-within:ring-2 focus-within:ring-sky-500/30";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            className="game-lite-modal fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col rounded-none border-y-0 border-r-0 shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="game-lite-icon !h-8 !w-8 !rounded-lg">
                  <GraduationCap className="h-4 w-4 text-sky-200" />
                </div>
                <h2 className="text-base font-bold text-white">Create Room</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-sky-200/60 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6"
            >
              <div>
                <label className="game-lite-label mb-1.5 block">
                  Room Name <span className="text-red-400">*</span>
                </label>
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Math 101, Morning Standup"
                  required
                />
              </div>

              <div>
                <label className="game-lite-label mb-1.5 block">Description</label>
                <textarea
                  className={inputCls + " !min-h-[5rem] !items-start resize-none py-2.5"}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this room for?"
                  rows={3}
                />
              </div>

              <div>
                <label className="game-lite-label mb-1.5 block">Category</label>
                <select
                  className={inputCls + " appearance-none"}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="" className="bg-[#152238]">
                    Select category…
                  </option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c.toLowerCase()} className="bg-[#152238]">
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="game-lite-label mb-1.5 block">Participant Limit</label>
                <input
                  type="number"
                  min={MIN_LIBRARY_PARTICIPANTS}
                  max={MAX_LIBRARY_PARTICIPANTS}
                  className={inputCls}
                  value={limit}
                  onChange={(e) => handleLimitChange(e.target.value)}
                  onBlur={() => {
                    if (limit === "") setLimit(String(MIN_LIBRARY_PARTICIPANTS));
                  }}
                />
                <p className="mt-1.5 text-xs text-sky-200/50">
                  Up to {MAX_LIBRARY_PARTICIPANTS} seats — matches library layout.
                </p>
                <p className="mt-1 text-xs font-medium text-sky-300/80">
                  This room will have <span className="text-white">{seatCount}</span> seats.
                </p>
              </div>

              <div>
                <label className="game-lite-label mb-2 block">Privacy</label>
                <div className="grid gap-2">
                  {PRIVACY_OPTIONS.map(({ value, label, icon: Icon, helper }) => {
                    const selected = isPrivate === value;
                    return (
                      <button
                        key={String(value)}
                        type="button"
                        onClick={() => setIsPrivate(value)}
                        className={
                          "rounded-xl border p-3 text-left transition " +
                          (selected
                            ? "border-sky-500/50 bg-sky-500/10"
                            : "border-[#1a3050] bg-black/20 hover:border-sky-600/30")
                        }
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            className={
                              "h-4 w-4 " + (selected ? "text-sky-300" : "text-sky-200/50")
                            }
                          />
                          <span
                            className={
                              "text-sm font-bold " +
                              (selected ? "text-white" : "text-sky-200/70")
                            }
                          >
                            {label}
                          </span>
                        </div>
                        <p className="mt-1 pl-6 text-xs leading-relaxed text-sky-200/50">
                          {helper}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {err && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {err}
                </p>
              )}

              <div className="mt-auto pt-4">
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="game-lite-btn-sky w-full !min-h-[2.75rem] disabled:opacity-50"
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
