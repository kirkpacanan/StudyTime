"use client";

import {
  endActivity,
  getActivity,
  getActivitySessions,
  getRoomRole,
  startActivity,
} from "@/lib/focus-hub/client";
import {
  ACTIVITY_TYPE_LABELS,
  type FocusHubActivity,
  type FocusHubSession,
} from "@/lib/focus-hub/types";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  CalendarClock,
  CheckCircle,
  Clock,
  PlayCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function ActivityDetailPage() {
  const { roomId, activityId } = useParams<{ roomId: string; activityId: string }>();
  const [activity, setActivity] = useState<FocusHubActivity | null>(null);
  const [sessions, setSessions] = useState<
    Array<FocusHubSession & { name?: string; avatar_url?: string | null }>
  >([]);
  const [role, setRole] = useState<"host" | "participant" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [act, sess, r] = await Promise.all([
        getActivity(activityId),
        getActivitySessions(activityId),
        getRoomRole(roomId),
      ]);
      setActivity(act);
      setSessions(sess);
      setRole(r);
      setLoading(false);
    })();
  }, [activityId, roomId]);

  async function handleStart() {
    const updated = await startActivity(activityId);
    setActivity(updated);
  }

  async function handleEnd() {
    const updated = await endActivity(activityId);
    setActivity(updated);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="h-40 animate-pulse rounded-2xl border border-[var(--cc-border)] bg-white/5" />
        <div className="h-32 animate-pulse rounded-2xl border border-[var(--cc-border)] bg-white/5" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="py-20 text-center text-muted">
        <p className="text-sm">Activity not found.</p>
        <Link href={`/focus-hub/${roomId}`} className="mt-2 block text-sm text-primary hover:underline">
          Back to Room
        </Link>
      </div>
    );
  }

  const isHost = role === "host";
  const mySession = sessions[0];

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
        <h1 className="text-xl font-bold text-text">{activity.title}</h1>
      </div>

      {/* Activity info */}
      <div className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-0.5 text-sky-400 font-medium">
            {ACTIVITY_TYPE_LABELS[activity.activity_type]}
          </span>
          {activity.duration_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {activity.duration_minutes} min
            </span>
          )}
          {activity.due_at && (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              Due {fmt(activity.due_at)}
            </span>
          )}
          {activity.focus_required && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Brain className="h-3.5 w-3.5" />
              Focus tracked
            </span>
          )}
        </div>

        {activity.description && (
          <p className="text-sm text-text/80">{activity.description}</p>
        )}

        {activity.instructions && (
          <div className="rounded-xl border border-[var(--cc-border)] bg-white/5 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Instructions
            </p>
            <p className="whitespace-pre-wrap text-sm text-text/80">
              {activity.instructions}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {activity.status === "draft" && isHost && (
            <button
              type="button"
              onClick={() => void handleStart()}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow shadow-emerald-900/30 transition hover:bg-emerald-500"
            >
              <PlayCircle className="h-4 w-4" />
              Start Activity
            </button>
          )}
          {activity.status === "active" && isHost && (
            <button
              type="button"
              onClick={() => void handleEnd()}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
            >
              End Activity
            </button>
          )}
          {activity.status === "active" && !isHost && (
            <Link
              href={`/focus-hub/${roomId}/activities/${activityId}/focus`}
              className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow shadow-sky-900/30 transition hover:bg-sky-500"
            >
              <PlayCircle className="h-4 w-4" />
              Join & Track Focus
            </Link>
          )}
          {activity.status === "completed" && (
            <span className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              Completed
            </span>
          )}
        </div>
      </div>

      {/* My session summary */}
      {!isHost && mySession && (
        <div className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5">
          <p className="mb-3 text-sm font-semibold text-text">My Focus Summary</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/5 p-3 text-center">
              <p className="text-xs text-muted">Avg Focus</p>
              <p className="text-xl font-bold text-primary">
                {mySession.average_focus ?? "—"}%
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-3 text-center">
              <p className="text-xs text-muted">Samples</p>
              <p className="text-xl font-bold text-text">
                {(mySession.samples as unknown[]).length}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-3 text-center">
              <p className="text-xs text-muted">Submitted</p>
              <p className="text-xl font-bold text-text">
                {mySession.submitted ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sessions list (host) */}
      {isHost && sessions.length > 0 && (
        <div className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] overflow-hidden">
          <div className="border-b border-[var(--cc-border)] px-5 py-3">
            <p className="text-sm font-semibold text-text">
              Participant Sessions ({sessions.length})
            </p>
          </div>
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between border-b border-[var(--cc-border)] px-5 py-3 last:border-0"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                  {initials(s.user_id.slice(0, 4))}
                </div>
                <p className="text-sm text-text font-mono text-xs">{s.user_id.slice(0, 8)}…</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span>{s.average_focus ?? "—"}% focus</span>
                {s.flagged && (
                  <span className="text-red-400 font-medium">Flagged</span>
                )}
                {s.submitted && (
                  <span className="text-emerald-400 font-medium">Submitted</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
