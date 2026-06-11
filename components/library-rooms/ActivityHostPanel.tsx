"use client";

import {
  createActivity,
  endActivity,
  startActivity,
  updateActivity,
} from "@/lib/focus-hub/client";
import type { FocusHubActivity } from "@/lib/focus-hub/types";
import { cn } from "@/lib/cn";
import { Calendar, Maximize2, Minimize2, Play, Save, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

type ActivityHostPanelProps = {
  roomId: string;
  activity: FocusHubActivity | null;
  open: boolean;
  onClose: () => void;
  onActivityChange: () => void;
  isImmersive?: boolean;
  onToggleImmersive?: () => void;
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ActivityHostPanel({
  roomId,
  activity,
  open,
  onClose,
  onActivityChange,
  isImmersive = false,
  onToggleImmersive,
}: ActivityHostPanelProps) {
  const [title, setTitle] = useState(activity?.title ?? "Study activity");
  const [scheduledStart, setScheduledStart] = useState(
    toLocalInputValue(activity?.scheduled_start_at ?? null),
  );
  const [scheduledEnd, setScheduledEnd] = useState(
    toLocalInputValue(activity?.scheduled_end_at ?? null),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(activity?.title ?? "Study activity");
    setScheduledStart(toLocalInputValue(activity?.scheduled_start_at ?? null));
    setScheduledEnd(toLocalInputValue(activity?.scheduled_end_at ?? null));
    setErr(null);
  }, [open, activity?.id, activity?.title, activity?.scheduled_start_at, activity?.scheduled_end_at]);

  if (!open) return null;

  function validateSchedule(): string | null {
    if (scheduledStart && scheduledEnd) {
      const start = new Date(scheduledStart).getTime();
      const end = new Date(scheduledEnd).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
        return "Scheduled end must be after the start time.";
      }
    }
    return null;
  }

  async function handleCreate() {
    const validationErr = validateSchedule();
    if (validationErr) {
      setErr(validationErr);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await createActivity({
        room_id: roomId,
        title: title.trim() || "Study activity",
        activity_type: "study_session",
        scheduled_start_at: scheduledStart ? new Date(scheduledStart).toISOString() : undefined,
        scheduled_end_at: scheduledEnd ? new Date(scheduledEnd).toISOString() : undefined,
      });
      onActivityChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create activity");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSchedule() {
    if (!activity) return;
    const validationErr = validateSchedule();
    if (validationErr) {
      setErr(validationErr);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await updateActivity(activity.id, {
        title: title.trim() || activity.title,
        scheduled_start_at: scheduledStart ? new Date(scheduledStart).toISOString() : null,
        scheduled_end_at: scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
      });
      onActivityChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update schedule");
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    if (!activity) return;
    setErr(null);
    setBusy(true);
    try {
      await startActivity(activity.id);
      onActivityChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start activity");
    } finally {
      setBusy(false);
    }
  }

  async function handleEnd() {
    if (!activity) return;
    setErr(null);
    setBusy(true);
    try {
      await endActivity(activity.id);
      onActivityChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not end activity");
    } finally {
      setBusy(false);
    }
  }

  const isActive = activity?.status === "active";
  const isCompleted = activity?.status === "completed";
  const canEditSchedule = Boolean(activity) && !isCompleted;

  return (
    <div className="fixed inset-0 z-[260] flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="game-lite-modal flex h-full w-full max-w-md flex-col rounded-none border-l border-[var(--cc-border)] p-0 sm:rounded-l-2xl">
        <div className="flex items-center justify-between border-b border-[var(--cc-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-text">Host activity</h2>
            <p className="text-xs text-muted">Schedule, start, and end the group session</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted transition hover:bg-white/10 hover:text-text"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {activity ? (
            <div className="rounded-xl border border-[var(--cc-border)] bg-white/5 p-4">
              <p className="text-xs capitalize text-muted">Status: {activity.status}</p>
              {isActive ? (
                <p className="mt-1 text-xs text-emerald-300/90">
                  Activity is live — you can still adjust the schedule below.
                </p>
              ) : null}
              {activity.scheduled_end_at ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-sky-200/80">
                  <Calendar className="h-3.5 w-3.5" />
                  Ends {new Date(activity.scheduled_end_at).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}

          {canEditSchedule || !activity ? (
            <>
              <label className="block text-xs font-medium text-muted">
                Activity title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-[var(--cc-border)] bg-white/5 px-3 py-2 text-sm text-text disabled:opacity-50"
                />
              </label>
              <label className="block text-xs font-medium text-muted">
                Scheduled start
                <input
                  type="datetime-local"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-[var(--cc-border)] bg-white/5 px-3 py-2 text-sm text-text disabled:opacity-50"
                />
              </label>
              <label className="block text-xs font-medium text-muted">
                Scheduled end
                <input
                  type="datetime-local"
                  value={scheduledEnd}
                  onChange={(e) => setScheduledEnd(e.target.value)}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-[var(--cc-border)] bg-white/5 px-3 py-2 text-sm text-text disabled:opacity-50"
                />
              </label>
              {activity ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSaveSchedule()}
                  className="game-lite-btn-gold flex w-full items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {busy ? "Saving…" : "Save schedule"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCreate()}
                  className="game-lite-btn-gold w-full disabled:opacity-50"
                >
                  Create activity
                </button>
              )}
            </>
          ) : null}

          {activity && !isCompleted ? (
            <div className="flex flex-col gap-2">
              {!isActive ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleStart()}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white",
                    "transition hover:bg-emerald-500 disabled:opacity-50",
                  )}
                >
                  <Play className="h-4 w-4" />
                  Start activity
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleEnd()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 disabled:opacity-50"
                >
                  <Square className="h-4 w-4" />
                  End activity
                </button>
              )}
            </div>
          ) : null}

          {err ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {err}
            </p>
          ) : null}
        </div>

        {onToggleImmersive ? (
          <div className="border-t border-[var(--cc-border)] px-5 py-3">
            <button
              type="button"
              onClick={onToggleImmersive}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--cc-border)] bg-white/5 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white/10",
                isImmersive && "ring-1 ring-amber-400/30",
              )}
            >
              {isImmersive ? (
                <Minimize2 className="h-4 w-4 text-amber-200" />
              ) : (
                <Maximize2 className="h-4 w-4 text-slate-300" />
              )}
              {isImmersive ? "Exit fullscreen" : "Fullscreen"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
