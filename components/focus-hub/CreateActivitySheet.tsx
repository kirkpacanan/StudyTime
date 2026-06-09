"use client";

import { createActivity } from "@/lib/focus-hub/client";
import {
  ACTIVITY_TYPE_LABELS,
  type ActivityType,
  type FocusHubActivity,
} from "@/lib/focus-hub/types";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, X } from "lucide-react";
import { useState } from "react";

const ACTIVITY_TYPES = Object.entries(ACTIVITY_TYPE_LABELS) as [ActivityType, string][];

type CreateActivitySheetProps = {
  open: boolean;
  roomId: string;
  onClose: () => void;
  onCreated: (activity: FocusHubActivity) => void;
};

export function CreateActivitySheet({
  open,
  roomId,
  onClose,
  onCreated,
}: CreateActivitySheetProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("study_session");
  const [dueAt, setDueAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("25");
  const [focusRequired, setFocusRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setErr(null);
    setLoading(true);
    try {
      const activity = await createActivity({
        room_id: roomId,
        title: title.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        activity_type: activityType,
        due_at: dueAt || undefined,
        duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : undefined,
        focus_required: focusRequired,
      });
      onCreated(activity);
      onClose();
      setTitle(""); setDescription(""); setInstructions(""); setDueAt("");
      setDurationMinutes("25"); setFocusRequired(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create activity.");
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
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--cc-border)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <ClipboardList className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-text">Create Activity</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted transition hover:bg-white/10 hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6"
            >
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Title <span className="text-alert">*</span>
                </label>
                <input
                  className={inputCls}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chapter 3 Study Session"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Activity Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ACTIVITY_TYPES.map(([type, label]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setActivityType(type)}
                      className={
                        "rounded-xl border px-3 py-2 text-xs font-medium transition " +
                        (activityType === type
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-[var(--cc-border)] bg-white/5 text-muted hover:text-text")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Description
                </label>
                <textarea
                  className={inputCls + " resize-none"}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief overview of the activity"
                  rows={2}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Instructions
                </label>
                <textarea
                  className={inputCls + " resize-none"}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Step-by-step instructions for participants"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    className={inputCls}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">
                    Due Date
                  </label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                  />
                </div>
              </div>

              {/* Focus required toggle */}
              <div className="flex items-center justify-between rounded-xl border border-[var(--cc-border)] bg-white/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text">Require Focus Tracking</p>
                  <p className="text-xs text-muted">
                    Participants must enable their camera during this activity.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFocusRequired((v) => !v)}
                  className={
                    "relative h-6 w-11 rounded-full transition " +
                    (focusRequired ? "bg-primary" : "bg-white/20")
                  }
                >
                  <span
                    className={
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all " +
                      (focusRequired ? "left-[calc(100%-1.375rem)]" : "left-0.5")
                    }
                  />
                </button>
              </div>

              {err && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  {err}
                </p>
              )}

              <div className="mt-auto pt-4">
                <button
                  type="submit"
                  disabled={loading || !title.trim()}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? "Creating…" : "Create Activity"}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
