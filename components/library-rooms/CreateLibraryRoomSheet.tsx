"use client";

import { createLibraryRoom } from "@/lib/library-rooms";
import type { LibraryRoom } from "@/lib/library-rooms";
import {
  clampParticipantLimit,
  MAX_LIBRARY_PARTICIPANTS,
  MIN_LIBRARY_PARTICIPANTS,
} from "@/lib/library/seats";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Activity, BarChart3, Camera, Mail, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CATEGORIES = ["Education", "Business", "Training", "Meeting", "Other"];
const SHEET_SPRING = { type: "spring" as const, stiffness: 320, damping: 34 };

function parseInviteEmails(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  ];
}

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
  const [inviteEmails, setInviteEmails] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const seatCountPreview = useMemo(() => {
    const n = parseInt(limit, 10);
    if (limit === "" || Number.isNaN(n)) return MIN_LIBRARY_PARTICIPANTS;
    if (n > MAX_LIBRARY_PARTICIPANTS) return MAX_LIBRARY_PARTICIPANTS;
    return n;
  }, [limit]);

  const parsedInvites = useMemo(() => parseInviteEmails(inviteEmails), [inviteEmails]);

  const displayName = name.trim() || "Your activity room";
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
        room_type: "activity",
        invite_emails: parsedInvites,
      });
      onCreated(room);
      onClose();
      setName("");
      setDescription("");
      setCategory("");
      setLimit("10");
      setInviteEmails("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create activity room.");
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
            key="create-activity-room-overlay"
            type="button"
            aria-label="Close create activity room"
            className="absolute inset-0 z-[30] border-0 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={loading ? undefined : onClose}
          />

          <motion.aside
            key="create-activity-room-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-activity-room-title"
            className="game-lite-sheet absolute inset-y-3 right-0 z-[40] flex w-full max-w-md flex-col overflow-hidden rounded-l-xl shadow-2xl"
            initial={reduce ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={reduce ? { duration: 0.01 } : SHEET_SPRING}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-5 py-3">
              <div className="flex items-center gap-2">
                <div className="game-lite-icon !h-8 !w-8 !rounded-lg">
                  <Activity className="h-4 w-4 text-sky-200" />
                </div>
                <h2 id="create-activity-room-title" className="text-sm font-bold text-white">
                  Create Activity Room
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
                <p className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-[11px] leading-relaxed text-violet-100/90">
                  For open study, everyone uses the Main Library. Activity rooms are
                  invite-only — email or join code — with host analytics and monitoring
                  snapshots for every session.
                </p>

                <div>
                  <label className="game-lite-label mb-1 block">
                    Room name <span className="text-red-400">*</span>
                  </label>
                  <input
                    className={inputCls}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. CS 101 Focus Lab"
                    required
                  />
                </div>

                <div>
                  <label className="game-lite-label mb-1 block">Description</label>
                  <textarea
                    className={inputCls + " !min-h-[3.25rem] !items-start resize-none py-2"}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What will participants do here?"
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
                      {MIN_LIBRARY_PARTICIPANTS}–{MAX_LIBRARY_PARTICIPANTS} participants
                    </p>
                  </div>
                </div>

                <div>
                  <label className="game-lite-label mb-1 flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    Invite by email
                  </label>
                  <textarea
                    className={inputCls + " !min-h-[3rem] !items-start resize-none py-2 font-normal"}
                    value={inviteEmails}
                    onChange={(e) => setInviteEmails(e.target.value)}
                    placeholder="one@school.edu, two@school.edu"
                    rows={2}
                  />
                  <p className="mt-1 text-[10px] text-sky-200/45">
                    Invited users can accept from the library lobby. Others need your join code.
                  </p>
                  {parsedInvites.length > 0 && (
                    <p className="mt-1 text-[10px] font-medium text-emerald-300/90">
                      {parsedInvites.length} invite{parsedInvites.length !== 1 ? "s" : ""} ready to send
                    </p>
                  )}
                </div>

                {err ? (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">
                    {err}
                  </p>
                ) : null}
              </div>

              <div className="flex min-h-0 flex-1 flex-col justify-end px-5 pb-4">
                <div className="game-lite-enter-panel !space-y-2">
                  <p className="game-lite-label">Preview</p>
                  <div className="flex items-start gap-3">
                    <div className="game-lite-icon !h-10 !w-10 shrink-0">
                      <Activity className="h-4 w-4 text-sky-200" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-bold text-white">{displayName}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-sky-200/55">
                        {description.trim() || "Invite-only activity room with host analytics."}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="game-lite-badge game-lite-badge-sky">{displayCategory}</span>
                        <span className="game-lite-badge border-violet-500/35 bg-violet-500/12 text-violet-200">
                          <Activity className="h-2.5 w-2.5" />
                          Activity room
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300/70">
                          <Users className="h-3.5 w-3.5" />
                          1 / {seatCountPreview}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-sky-200/50">
                        <span className="inline-flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          Analytics
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          Snapshots
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          Email + code access
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-white/[0.08] bg-[#0f1a2a]/90 px-5 py-4">
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="game-lite-btn-sky w-full !min-h-[2.5rem] disabled:opacity-50"
                >
                  {loading ? "Creating…" : "Create activity room"}
                </button>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
