"use client";

import { FocusGauge } from "@/components/FocusGauge";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useSessionLive } from "@/contexts/session-live-context";
import { useAuth } from "@/hooks/useAuth";
import { persistStudySession } from "@/hooks/useStudySession";
import type { FocusFrameResult } from "@/lib/focus-detection";
import { getSettings } from "@/lib/storage";
import type { FocusSample, UserSettings } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const FocusCamera = dynamic(
  () =>
    import("@/components/FocusCamera").then((m) => ({
      default: m.FocusCamera,
    })),
  { ssr: false, loading: () => <p className="text-sm text-muted">Loading camera…</p> },
);

type Phase = "focus" | "break";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SessionPage() {
  const { user } = useAuth();
  const { setLive, resetLive } = useSessionLive();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<Phase>("focus");
  const [remainingSec, setRemainingSec] = useState(0);
  const [focusCompleted, setFocusCompleted] = useState(0);
  const samplesRef = useRef<FocusSample[]>([]);
  const sessionStartedAtRef = useRef<string | null>(null);
  const focusMsRef = useRef(0);
  const breakMsRef = useRef(0);
  const sessionMsRef = useRef(0);
  const phaseRef = useRef<Phase>("focus");
  const [lastSample, setLastSample] = useState<{
    score: number;
    state: FocusSample["state"];
  }>({ score: 0, state: "away" });
  const [useManual, setUseManual] = useState(false);
  const [manualScore, setManualScore] = useState(75);

  useEffect(() => {
    if (!user) return;
    setSettings(getSettings(user.id));
  }, [user]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const focusSec = (settings?.focusMinutes ?? 25) * 60;
  const shortBreakSec = (settings?.shortBreakMinutes ?? 5) * 60;
  const longBreakSec = (settings?.longBreakMinutes ?? 15) * 60;
  const longEvery = settings?.longBreakEvery ?? 4;
  const focusThreshold = settings?.focusThreshold ?? 70;
  const distractionThreshold = settings?.distractionThreshold ?? 40;
  const webcamEnabled = settings?.webcamEnabled ?? true;
  const notify = settings?.notificationsEnabled ?? false;

  const notifyUser = useCallback(
    (title: string, body: string) => {
      if (!notify) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      new Notification(title, { body });
    },
    [notify],
  );

  const completeCurrentPhaseRef = useRef<() => void>(() => {});

  const completeCurrentPhase = useCallback(() => {
    if (phaseRef.current === "focus") {
      setFocusCompleted((c) => {
        const next = c + 1;
        const isLong = next > 0 && next % longEvery === 0;
        setRemainingSec(isLong ? longBreakSec : shortBreakSec);
        notifyUser(
          "Break time",
          isLong
            ? "Long break — stretch, hydrate, and reset."
            : "Short break — step away from the screen.",
        );
        return next;
      });
      phaseRef.current = "break";
      setPhase("break");
    } else {
      phaseRef.current = "focus";
      setPhase("focus");
      setRemainingSec(focusSec);
      notifyUser("Focus block", "Time for your next focus stretch.");
    }
  }, [
    focusSec,
    longBreakSec,
    longEvery,
    notifyUser,
    shortBreakSec,
  ]);

  completeCurrentPhaseRef.current = completeCurrentPhase;

  const endSession = useCallback(() => {
    setRunning(false);
    setPaused(false);
    resetLive();
    if (typeof document !== "undefined") document.title = "StudyTime";
    const started = sessionStartedAtRef.current;
    if (user && started && samplesRef.current.length > 0) {
      persistStudySession(
        user.id,
        started,
        samplesRef.current,
        focusMsRef.current,
        breakMsRef.current,
        focusThreshold,
      );
    }
    sessionStartedAtRef.current = null;
    samplesRef.current = [];
    focusMsRef.current = 0;
    breakMsRef.current = 0;
    sessionMsRef.current = 0;
    setFocusCompleted(0);
    phaseRef.current = "focus";
    setPhase("focus");
    setRemainingSec(0);
  }, [focusThreshold, resetLive, user]);

  useEffect(() => {
    if (!running || paused) return;
    const id = window.setInterval(() => {
      setRemainingSec((s) => {
        if (s <= 0) return s;
        sessionMsRef.current += 1000;
        if (phaseRef.current === "focus") focusMsRef.current += 1000;
        else breakMsRef.current += 1000;
        if (s === 1) {
          queueMicrotask(() => completeCurrentPhaseRef.current());
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, paused]);

  useEffect(() => {
    if (!running) return;
    const title =
      phase === "focus"
        ? `Focus ${fmt(remainingSec)} · StudyTime`
        : `Break ${fmt(remainingSec)} · StudyTime`;
    document.title = title;
  }, [running, phase, remainingSec]);

  useEffect(() => {
    setLive({
      running,
      phase,
      focusState: phase === "focus" ? lastSample.state : null,
      score: phase === "focus" ? lastSample.score : null,
    });
  }, [running, phase, lastSample, setLive]);

  useEffect(() => () => resetLive(), [resetLive]);

  const onSample = useCallback(
    (sample: FocusFrameResult) => {
      setLastSample({ score: sample.score, state: sample.state });
      if (!running || paused || phaseRef.current !== "focus") return;
      samplesRef.current.push({
        t: sessionMsRef.current,
        score: sample.score,
        state: sample.state,
      });
    },
    [running, paused],
  );

  const startSession = () => {
    if (!settings || !user) return;
    samplesRef.current = [];
    focusMsRef.current = 0;
    breakMsRef.current = 0;
    sessionMsRef.current = 0;
    setFocusCompleted(0);
    sessionStartedAtRef.current = new Date().toISOString();
    phaseRef.current = "focus";
    setPhase("focus");
    setRemainingSec(settings.focusMinutes * 60);
    setRunning(true);
    setPaused(false);
  };

  const phaseTotalSec = useMemo(() => {
    if (phase === "focus") return focusSec;
    const isLong =
      focusCompleted > 0 && focusCompleted % longEvery === 0;
    return isLong ? longBreakSec : shortBreakSec;
  }, [
    phase,
    focusSec,
    shortBreakSec,
    longBreakSec,
    longEvery,
    focusCompleted,
  ]);

  const phaseProgress = useMemo(() => {
    if (!running || !phaseTotalSec) return 0;
    return Math.min(
      100,
      Math.max(0, ((phaseTotalSec - remainingSec) / phaseTotalSec) * 100),
    );
  }, [running, phaseTotalSec, remainingSec]);

  if (!user || !settings) {
    return (
      <div className="text-sm text-muted">
        Loading your session settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          Study session
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pomodoro timer with live focus from your webcam (or manual mode).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Timer
              </p>
              <p className="text-3xl font-semibold tabular-nums text-text">
                {running ? fmt(remainingSec) : "—"}
              </p>
            </div>
            <Badge tone={phase === "focus" ? "blue" : "green"}>
              {running ? (phase === "focus" ? "Focus block" : "Break") : "Idle"}
            </Badge>
          </div>
          <Progress value={running ? phaseProgress : 0} />
          <p className="text-xs text-muted">
            Completed focus blocks this session: {focusCompleted} · Long break
            every {longEvery}
          </p>
          <div className="flex flex-wrap gap-2">
            {!running ? (
              <Button type="button" onClick={startSession}>
                Start session
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPaused((p) => !p)}
                >
                  {paused ? "Resume" : "Pause"}
                </Button>
                <Button type="button" variant="danger" onClick={endSession}>
                  End & save
                </Button>
              </>
            )}
          </div>
        </Card>

        <Card className="flex flex-col items-center gap-3">
          <FocusGauge value={lastSample.score} state={lastSample.state} />
          <Badge
            tone={
              lastSample.state === "focused"
                ? "blue"
                : lastSample.state === "drifting"
                  ? "yellow"
                  : lastSample.state === "distracted" ||
                      lastSample.state === "away"
                    ? "red"
                    : "muted"
            }
          >
            {lastSample.state}
          </Badge>
          <p className="text-center text-xs text-muted">
            Thresholds: focused ≥{focusThreshold}% · distracted &lt;
            {distractionThreshold}%
          </p>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text">Webcam focus</h2>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={useManual}
              onChange={(e) => setUseManual(e.target.checked)}
              className="rounded border-primary/30 text-primary focus:ring-primary"
            />
            Manual focus slider
          </label>
        </div>
        {(useManual || !webcamEnabled) && (
          <div>
            <label className="text-xs font-medium text-muted" htmlFor="manual">
              Assumed focus level
            </label>
            <input
              id="manual"
              type="range"
              min={0}
              max={100}
              value={manualScore}
              onChange={(e) => setManualScore(Number(e.target.value))}
              className="mt-2 w-full accent-primary"
            />
            <p className="mt-1 text-xs text-muted">{manualScore}%</p>
          </div>
        )}
        <FocusCamera
          enabled={webcamEnabled && !useManual}
          active={running && !paused && phase === "focus"}
          focusThreshold={focusThreshold}
          distractionThreshold={distractionThreshold}
          manualScore={useManual || !webcamEnabled ? manualScore : null}
          onSample={onSample}
        />
      </Card>
    </div>
  );
}
