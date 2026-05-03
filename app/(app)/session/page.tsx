"use client";

import { FocusGauge } from "@/components/FocusGauge";
import { FocusSignalBars } from "@/components/FocusSignalBars";
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
import { motion } from "framer-motion";
import { Brain, Timer } from "lucide-react";
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
  const [lastSample, setLastSample] = useState<FocusFrameResult>({
    score: 0,
    state: "away",
    rawEar: 0,
    hasFace: false,
    eyesScore: 0,
    faceScore: 0,
  });
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
      setLastSample(sample);
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

  const timerRingR = 56;
  const timerCirc = 2 * Math.PI * timerRingR;
  const timerOffset = timerCirc * (1 - (running ? phaseProgress : 0) / 100);

  return (
    <div className="relative space-y-8">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl dark:bg-cyan-500/15" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-success/15 blur-3xl dark:bg-emerald-500/10" />

      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <div className="mb-1 flex items-center gap-2 text-primary dark:text-cyan-300">
            <Brain className="h-5 w-5" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">
              Session
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Deep focus cockpit
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Pomodoro timer plus live vision:{" "}
            <strong className="font-medium text-text">eyes</strong> (openness)
            and <strong className="font-medium text-text">face</strong>{" "}
            (toward camera) both feed the focus score — watch the rings track
            you in real time.
          </p>
        </div>
        {running ? (
          <Badge tone={phase === "focus" ? "blue" : "green"} className="w-fit shrink-0">
            {phase === "focus" ? "Focus block" : "Break"}
          </Badge>
        ) : (
          <Badge tone="muted" className="w-fit shrink-0">
            Ready
          </Badge>
        )}
      </motion.header>

      <div className="relative grid gap-6 xl:grid-cols-12">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4 xl:col-span-7"
        >
          <Card className="overflow-hidden p-1">
            <div className="glass-inset p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary dark:bg-cyan-500/15 dark:text-cyan-300">
                    <Timer className="h-4 w-4" aria-hidden />
                  </span>
                  Live vision
                </h2>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={useManual}
                    onChange={(e) => setUseManual(e.target.checked)}
                    className="rounded border-primary/30 text-primary focus:ring-primary"
                  />
                  Manual slider
                </label>
              </div>
              {(useManual || !webcamEnabled) && (
                <div className="mb-4 rounded-xl border border-white/55 bg-white/[0.26] p-3 backdrop-blur-xl backdrop-saturate-200 dark:border-white/[0.16] dark:bg-slate-900/[0.36]">
                  <label
                    className="text-xs font-medium text-muted"
                    htmlFor="manual"
                  >
                    Assumed focus (eyes &amp; face)
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
                  <p className="mt-1 text-xs tabular-nums text-muted">
                    {manualScore}% · both signals follow this value
                  </p>
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
            </div>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-4 xl:col-span-5"
        >
          <Card className="relative overflow-hidden p-6">
            <div className="absolute right-4 top-4 h-24 w-24 rounded-full bg-primary/10 blur-2xl dark:bg-cyan-500/10" />
            <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
                <svg
                  className="-rotate-90 text-primary-soft dark:text-slate-800"
                  width="160"
                  height="160"
                  aria-hidden
                >
                  <circle
                    cx="80"
                    cy="80"
                    r={timerRingR}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r={timerRingR}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={timerCirc}
                    strokeDashoffset={timerOffset}
                    strokeLinecap="round"
                    className={
                      phase === "focus"
                        ? "text-primary transition-[stroke-dashoffset] duration-1000 dark:text-cyan-400"
                        : "text-success transition-[stroke-dashoffset] duration-1000 dark:text-emerald-400"
                    }
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                    {running ? (phase === "focus" ? "Focus" : "Break") : "Timer"}
                  </p>
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-text sm:text-4xl">
                    {running ? fmt(remainingSec) : "—"}
                  </p>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
                <Progress value={running ? phaseProgress : 0} className="h-1.5" />
                <p className="text-xs text-muted">
                  Blocks done:{" "}
                  <span className="font-semibold text-text">{focusCompleted}</span>{" "}
                  · long break every {longEvery}
                </p>
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
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
                        End &amp; save
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-primary/15 p-5 dark:border-cyan-500/15">
            <p className="mb-4 text-center text-xs font-medium uppercase tracking-wide text-muted">
              Composite focus
            </p>
            <div className="flex flex-col items-center gap-4">
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
              <FocusSignalBars
                eyesScore={lastSample.eyesScore}
                faceScore={lastSample.faceScore}
              />
              <p className="text-center text-[11px] leading-relaxed text-muted">
                Score blends{" "}
                <span className="font-medium text-text">eyes</span> (~50%) and{" "}
                <span className="font-medium text-text">face</span> (~42%) plus
                light expression dampening. Focused ≥{focusThreshold}% · drifting
                between · distracted &lt;{distractionThreshold}%.
              </p>
            </div>
          </Card>
        </motion.section>
      </div>
    </div>
  );
}
