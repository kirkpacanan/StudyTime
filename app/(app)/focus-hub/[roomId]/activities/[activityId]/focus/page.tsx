"use client";

import { FocusCamera } from "@/components/FocusCamera";
import { useParticipantFocusHub } from "@/hooks/useFocusHubRoom";
import { getActivity, getRoomRole, submitSession } from "@/lib/focus-hub/client";
import type { FocusHubActivity } from "@/lib/focus-hub/types";
import type { FocusFrameResult } from "@/lib/focus-detection";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  CheckCircle,
  Clock,
  Shield,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

function padTime(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${padTime(m)}:${padTime(s)}`;
}

function focusColorClass(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function focusBarClass(score: number) {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

export default function FocusTrackingPage() {
  const { roomId, activityId } = useParams<{ roomId: string; activityId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [activity, setActivity] = useState<FocusHubActivity | null>(null);
  const [role, setRole] = useState<"host" | "participant" | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentScore, setCurrentScore] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [avgFocusFinal, setAvgFocusFinal] = useState(0);

  const scoreHistoryRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { broadcastSample, flush } = useParticipantFocusHub({
    activityId,
    userId: user?.id ?? "",
    name: user?.name ?? "Student",
    avatarUrl: null,
  });

  useEffect(() => {
    void (async () => {
      const [act, r] = await Promise.all([
        getActivity(activityId),
        getRoomRole(roomId),
      ]);
      setActivity(act);
      setRole(r);
      setLoading(false);
    })();
  }, [activityId, roomId]);

  // Timer
  useEffect(() => {
    if (!sessionStarted || sessionEnded) return;
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionStarted, sessionEnded]);

  // Auto-end if duration elapsed
  useEffect(() => {
    if (
      activity?.duration_minutes &&
      elapsed >= activity.duration_minutes * 60 &&
      sessionStarted &&
      !sessionEnded
    ) {
      void handleEndSession();
    }
  }, [elapsed, activity, sessionStarted, sessionEnded]);

  const handleFrame = useCallback(
    (frame: FocusFrameResult) => {
      if (!sessionStarted || sessionEnded) return;
      setCurrentScore(frame.score);
      scoreHistoryRef.current.push(frame.score);
      broadcastSample(frame);
    },
    [sessionStarted, sessionEnded, broadcastSample],
  );

  function handleStart() {
    setSessionStarted(true);
  }

  async function handleEndSession() {
    if (timerRef.current) clearInterval(timerRef.current);
    setSessionEnded(true);
    const scores = scoreHistoryRef.current;
    const avg =
      scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    setAvgFocusFinal(Math.round(avg));
    await flush();
    await submitSession(activityId);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="h-64 animate-pulse rounded-2xl border border-[var(--cc-border)] bg-white/5" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="py-20 text-center text-muted">
        <p>Activity not found.</p>
        <Link href={`/focus-hub/${roomId}`} className="mt-2 block text-sm text-primary hover:underline">
          Back to Room
        </Link>
      </div>
    );
  }

  if (activity.status !== "active") {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <ShieldAlert className="h-12 w-12 text-muted/40" />
        <p className="text-sm font-medium text-muted">
          {activity.status === "completed"
            ? "This activity has ended."
            : "This activity hasn't started yet."}
        </p>
        <Link
          href={`/focus-hub/${roomId}/activities/${activityId}`}
          className="rounded-xl border border-[var(--cc-border)] px-4 py-2 text-sm font-medium text-muted hover:text-text"
        >
          Back to Activity
        </Link>
      </div>
    );
  }

  if (role === "host") {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <Shield className="h-12 w-12 text-primary/40" />
        <p className="text-sm text-muted">Hosts don't participate in focus tracking.</p>
        <Link
          href={`/focus-hub/${roomId}/monitor`}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          Open Live Monitor
        </Link>
      </div>
    );
  }

  // Session ended summary
  if (sessionEnded) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="mx-auto flex max-w-sm flex-col items-center gap-6 py-16 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">Session Complete!</h2>
          <p className="mt-1 text-sm text-muted">
            Your focus data has been saved and submitted.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4">
            <p className="text-xs text-muted">Focus Score</p>
            <p className={`text-2xl font-bold ${focusColorClass(avgFocusFinal)}`}>
              {avgFocusFinal}%
            </p>
          </div>
          <div className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4">
            <p className="text-xs text-muted">Duration</p>
            <p className="text-2xl font-bold text-text">{fmtDuration(elapsed)}</p>
          </div>
        </div>
        <Link
          href={`/focus-hub/${roomId}/activities/${activityId}`}
          className="w-full rounded-xl border border-[var(--cc-border)] py-2.5 text-sm font-medium text-muted transition hover:text-text"
        >
          View Activity Details
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Back */}
      <div className="mb-4 flex items-center gap-3">
        <Link
          href={`/focus-hub/${roomId}/activities/${activityId}`}
          className="rounded-xl border border-[var(--cc-border)] p-2 text-muted transition hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-base font-semibold text-text">{activity.title}</h1>
          <p className="text-xs text-muted">Focus Tracking Session</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Camera panel */}
        <div className="overflow-hidden rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)]">
          <FocusCamera
            enabled={sessionStarted && !sessionEnded}
            active={sessionStarted && !sessionEnded}
            focusThreshold={65}
            distractionThreshold={40}
            onSample={handleFrame}
          />
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Score */}
          <div className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted">
              <Brain className="h-3.5 w-3.5" />
              Focus Score
            </div>
            <p className={`text-5xl font-bold tabular-nums ${focusColorClass(currentScore)}`}>
              {currentScore}<span className="text-xl font-normal text-muted">%</span>
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-700 ${focusBarClass(currentScore)}`}
                style={{ width: `${currentScore}%` }}
              />
            </div>
          </div>

          {/* Timer */}
          <div className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted">
              <Clock className="h-3.5 w-3.5" />
              Elapsed Time
            </div>
            <p className="font-mono text-3xl font-bold text-text">
              {fmtDuration(elapsed)}
            </p>
            {activity.duration_minutes && (
              <p className="mt-1 text-xs text-muted">
                / {fmtDuration(activity.duration_minutes * 60)}
              </p>
            )}
          </div>

          {/* Activity info */}
          {activity.instructions && (
            <div className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Instructions
              </p>
              <p className="text-xs text-text/80">{activity.instructions}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {!sessionStarted ? (
              <button
                type="button"
                onClick={handleStart}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow transition hover:bg-primary/90"
              >
                Start Focus Tracking
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleEndSession()}
                className="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
              >
                End Session
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
