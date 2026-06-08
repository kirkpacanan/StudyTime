"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { getSessionsForUser } from "@/lib/storage";
import type {
  DistractionRisk,
  FocusCategory,
  FocusPrediction,
} from "@/lib/ml/focus-prediction";
import type { StudySession } from "@/lib/types";
import { CalendarClock, Sparkles, Target } from "lucide-react";
import { useEffect, useState } from "react";

type Tone = "green" | "yellow" | "red";

const focusTone: Record<FocusCategory, Tone> = {
  High: "green",
  Medium: "yellow",
  Low: "red",
};

const riskTone: Record<DistractionRisk, Tone> = {
  Low: "green",
  Moderate: "yellow",
  High: "red",
};

const focusValueColor: Record<FocusCategory, string> = {
  High: "text-success",
  Medium: "text-accent dark:text-accent",
  Low: "text-alert",
};

/** Pretty feature names for the "key factors" line. */
const featureLabels: Record<string, string> = {
  prev_session_focus_score: "Recent focus",
  phone_detections: "Phone pickups",
  session_duration: "Session length",
  hour_of_day: "Time of day",
  streak_length: "Streak",
  distraction_events: "Distractions",
  day_of_week: "Day of week",
  drowsiness_count: "Drowsiness",
};

/**
 * @param sessions    Optional pre-loaded sessions (avoids a duplicate fetch when
 *                     the parent page already has them).
 * @param recommendedTime  Best-focus window from analytics, shown as the
 *                     "recommended study time" (the RF model predicts the level,
 *                     analytics decides when).
 */
export function FocusPredictionCard({
  sessions: providedSessions,
  recommendedTime,
}: {
  sessions?: StudySession[];
  recommendedTime?: string;
} = {}) {
  const { user } = useAuth();
  const [prediction, setPrediction] = useState<FocusPrediction | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function run() {
      try {
        const sessions = providedSessions ?? (await getSessionsForUser(user!.id));
        // Send a compact payload — strip the heavy per-sample arrays, keep only
        // the scalar fields + event types the model needs.
        const payload = sessions.map((s) => ({
          startedAt: s.startedAt,
          focusMs: s.focusMs,
          averageFocus: s.averageFocus,
          distractionEvents: s.distractionEvents,
          events: s.events?.map((e) => ({ type: e.type })) ?? null,
        }));

        const res = await fetch("/api/focus-prediction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessions: payload }),
        });

        if (cancelled) return;
        if (res.status === 422) {
          setStatus("empty");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        setPrediction((await res.json()) as FocusPrediction);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [user, providedSessions]);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-slate-200/80 bg-gradient-to-r from-white/45 to-transparent px-5 py-4 backdrop-blur-md dark:border-white/10 dark:from-slate-900/40 dark:to-transparent">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/15">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text">
            Predicted focus — next session
          </h2>
          <p className="text-xs text-muted">
            Random Forest model trained on your study patterns
          </p>
        </div>
      </div>

      <div className="p-5">
        {status === "loading" && (
          <p className="text-sm text-muted">Analyzing your sessions…</p>
        )}

        {status === "empty" && (
          <p className="text-sm text-muted">
            Complete a few study sessions and we&apos;ll predict your next focus
            level here.
          </p>
        )}

        {status === "error" && (
          <p className="text-sm text-muted">
            Couldn&apos;t generate a prediction right now. Try refreshing later.
          </p>
        )}

        {status === "ready" && prediction && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Predicted level
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <span
                    className={`text-3xl font-semibold tracking-tight ${focusValueColor[prediction.predictedFocus]}`}
                  >
                    {prediction.predictedFocus}
                  </span>
                  <Badge tone={focusTone[prediction.predictedFocus]}>
                    {Math.round(prediction.confidence * 100)}% confidence
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Distraction risk
                </p>
                <div className="mt-1 flex justify-end">
                  <Badge tone={riskTone[prediction.distractionRisk]}>
                    <Target className="mr-1 h-3.5 w-3.5" aria-hidden />
                    {prediction.distractionRisk}
                  </Badge>
                </div>
              </div>
            </div>

            {recommendedTime ? (
              <div className="flex items-center gap-3 rounded-xl border border-white/55 bg-white/[0.28] px-4 py-3 backdrop-blur-xl dark:border-white/[0.14] dark:bg-slate-900/[0.34]">
                <CalendarClock
                  className="h-5 w-5 shrink-0 text-primary dark:text-cyan-300"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Recommended study time
                  </p>
                  <p className="text-sm font-semibold text-text">
                    {recommendedTime}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-primary/15 bg-primary/[0.06] p-4 dark:border-cyan-500/20 dark:bg-cyan-500/[0.06]">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary dark:text-cyan-300">
                Recommendation
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-text">
                {prediction.recommendation}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Key factors
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {prediction.topFactors.map((f) => (
                  <Badge key={f.feature} tone="muted">
                    {featureLabels[f.feature] ?? f.feature} ·{" "}
                    {Math.round(f.importance * 100)}%
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
