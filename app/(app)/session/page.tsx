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
import { SessionSummaryCelebration } from "@/components/gamification/SessionSummaryCelebration";
import {
  computeSessionStats,
  persistStudySession,
} from "@/hooks/useStudySession";
import type { SessionCelebrationPayload } from "@/lib/gamification/session-celebration";
import { computeSessionCelebration } from "@/lib/gamification/session-celebration";
import type { FocusFrameResult } from "@/lib/focus-detection";
import { getSettings } from "@/lib/storage";
import type { FocusSample, SessionEvent, UserSettings } from "@/lib/types";
import { motion } from "framer-motion";
import { Brain, Sparkles, Timer, Video } from "lucide-react";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const FocusCamera = dynamic(
  () =>
    import("@/components/FocusCamera").then((m) => ({
      default: m.FocusCamera,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[200px] items-center justify-center bg-black/40 text-zinc-400 dark:text-zinc-500">
        <p className="text-sm">Loading camera…</p>
      </div>
    ),
  },
);

type Phase = "focus" | "break";

type AlarmController = {
  prime: () => void;
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  close: () => void;
};

function createAlarmController(): AlarmController {
  let ctx: AudioContext | null = null;
  let osc1: OscillatorNode | null = null;
  let osc2: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let lfo: OscillatorNode | null = null;
  let lfoGain: GainNode | null = null;

  let running = false;

  const ensure = async () => {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }
  };

  const teardownNodes = () => {
    try {
      osc1?.stop();
    } catch {
      // ignore
    }
    try {
      osc2?.stop();
    } catch {
      // ignore
    }
    try {
      lfo?.stop();
    } catch {
      // ignore
    }
    osc1?.disconnect();
    osc2?.disconnect();
    lfo?.disconnect();
    lfoGain?.disconnect();
    gain?.disconnect();
    osc1 = null;
    osc2 = null;
    gain = null;
    lfo = null;
    lfoGain = null;
  };

  return {
    prime: () => {
      void ensure();
    },
    start: () => {
      if (running) return;
      running = true;
      void (async () => {
        await ensure();
        if (!ctx) return;
        teardownNodes();

        gain = ctx.createGain();
        gain.gain.value = 0.0001;
        gain.connect(ctx.destination);

        // Two oscillators for a more piercing alarm timbre
        osc1 = ctx.createOscillator();
        osc1.type = "square";
        osc1.frequency.value = 880;
        osc1.connect(gain);

        osc2 = ctx.createOscillator();
        osc2.type = "sawtooth";
        osc2.frequency.value = 1320;
        osc2.connect(gain);

        // LFO to pulse volume (hard to ignore)
        lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 2.6;
        lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.45;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.7, now + 0.03);

        osc1.start();
        osc2.start();
        lfo.start();
      })();
    },
    stop: () => {
      if (!running) return;
      running = false;
      if (!ctx || !gain) {
        teardownNodes();
        return;
      }
      const now = ctx.currentTime;
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0.0, now + 0.08);
      } catch {
        // ignore
      }
      window.setTimeout(() => teardownNodes(), 120);
    },
    isRunning: () => running,
    close: () => {
      running = false;
      teardownNodes();
      if (ctx) {
        void ctx.close();
        ctx = null;
      }
    },
  };
}

function getLiveFlags(sample: FocusFrameResult): {
  flags?: {
    phoneDetected?: boolean;
    eyesClosed?: boolean;
    lookingAway?: boolean;
    headDown?: boolean;
    drowsy?: boolean;
    hasFace?: boolean;
  };
  durations?: {
    eyesClosedMs?: number;
    lookingAwayMs?: number;
    headDownMs?: number;
    phoneDetectedMs?: number;
    engagedMs?: number;
  };
} {
  const anySample = sample as FocusFrameResult & {
    flags?: unknown;
    durations?: unknown;
  };
  return {
    flags:
      (anySample.flags as
        | {
            phoneDetected?: boolean;
            eyesClosed?: boolean;
            lookingAway?: boolean;
            headDown?: boolean;
            drowsy?: boolean;
            hasFace?: boolean;
          }
        | undefined) ?? undefined,
    durations:
      (anySample.durations as
        | {
            eyesClosedMs?: number;
            lookingAwayMs?: number;
            headDownMs?: number;
            phoneDetectedMs?: number;
            engagedMs?: number;
          }
        | undefined) ?? undefined,
  };
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type SessionEndSummary = {
  saved: boolean;
  startedAt: string;
  endedAt: string;
  focusMs: number;
  breakMs: number;
  pomodoroBlocks: number;
  sampleCount: number;
  averageFocus: number;
  focusedRatio: number;
  distractionEvents: number;
  celebration: SessionCelebrationPayload | null;
};

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
  const eventsRef = useRef<SessionEvent[]>([]);
  const alarmRef = useRef<AlarmController | null>(null);
  const prevFlagsRef = useRef<{
    phoneDetected: boolean;
    eyesClosed10s: boolean;
    lookingAwayLong: boolean;
    headDownLong: boolean;
    alarmRunning: boolean;
  }>({
    phoneDetected: false,
    eyesClosed10s: false,
    lookingAwayLong: false,
    headDownLong: false,
    alarmRunning: false,
  });
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
    yaw: 0,
    pitch: 0,
  });
  const [summary, setSummary] = useState<SessionEndSummary | null>(null);
  const focusCompletedRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getSettings(user.id).then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    focusCompletedRef.current = focusCompleted;
  }, [focusCompleted]);

  useEffect(() => {
    if (!summary) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSummary(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [summary]);

  const focusSec = (settings?.focusMinutes ?? 25) * 60;
  const shortBreakSec = (settings?.shortBreakMinutes ?? 5) * 60;
  const longBreakSec = (settings?.longBreakMinutes ?? 15) * 60;
  const longEvery = settings?.longBreakEvery ?? 4;
  const focusThreshold = settings?.focusThreshold ?? 70;
  const distractionThreshold = settings?.distractionThreshold ?? 40;
  const webcamEnabled = settings?.webcamEnabled ?? true;
  const phoneDetectionEnabled = settings?.phoneDetectionEnabled ?? true;
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

  const endSession = useCallback(async () => {
    alarmRef.current?.stop();
    const started = sessionStartedAtRef.current;
    const samples = [...samplesRef.current];
    const focusMs = focusMsRef.current;
    const breakMs = breakMsRef.current;
    const blocks = focusCompletedRef.current;
    const endedAt = new Date().toISOString();

    const stats = computeSessionStats(
      samples,
      focusThreshold,
      focusMs,
      breakMs,
    );
    let saved = false;
    let celebration: SessionCelebrationPayload | null = null;
    if (user && started && samples.length > 0) {
      const session = await persistStudySession(
        user.id,
        started,
        samples,
        [...eventsRef.current],
        focusMs,
        breakMs,
        focusThreshold,
      );
      saved = true;
      celebration = await computeSessionCelebration(user, session);
    }

    setRunning(false);
    setPaused(false);
    resetLive();
    if (typeof document !== "undefined") document.title = "StudyTime";

    sessionStartedAtRef.current = null;
    samplesRef.current = [];
    eventsRef.current = [];
    focusMsRef.current = 0;
    breakMsRef.current = 0;
    sessionMsRef.current = 0;
    setFocusCompleted(0);
    phaseRef.current = "focus";
    setPhase("focus");
    setRemainingSec(0);

    setSummary({
      saved,
      startedAt: started ?? endedAt,
      endedAt,
      focusMs,
      breakMs,
      pomodoroBlocks: blocks,
      sampleCount: samples.length,
      averageFocus: stats.averageFocus,
      focusedRatio: stats.focusedRatio,
      distractionEvents: stats.distractionEvents,
      celebration,
    });
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
      const flags = (sample as FocusFrameResult & {
        flags?: {
          phoneDetected?: boolean;
          eyesClosed?: boolean;
          lookingAway?: boolean;
          headDown?: boolean;
          drowsy?: boolean;
          hasFace?: boolean;
        };
        durations?: {
          eyesClosedMs?: number;
          lookingAwayMs?: number;
          headDownMs?: number;
          phoneDetectedMs?: number;
        };
      }).flags;
      const durations = (sample as FocusFrameResult & {
        durations?: {
          eyesClosedMs?: number;
          lookingAwayMs?: number;
          headDownMs?: number;
          phoneDetectedMs?: number;
        };
      }).durations;

      // --- event logging (session-relative) ---
      const t = sessionMsRef.current;
      const prev = prevFlagsRef.current;
      const phoneNow = flags?.phoneDetected === true;
      const eyesClosed10sNow = (durations?.eyesClosedMs ?? 0) >= 10_000;
      const lookingAwayLongNow = (durations?.lookingAwayMs ?? 0) >= 6_000;
      const headDownLongNow = (durations?.headDownMs ?? 0) >= 4_500;

      if (phoneNow && !prev.phoneDetected) {
        eventsRef.current.push({ t, type: "phone_detected" });
      }
      if (lookingAwayLongNow && !prev.lookingAwayLong) {
        eventsRef.current.push({ t, type: "look_away_long" });
      }
      if (headDownLongNow && !prev.headDownLong) {
        eventsRef.current.push({ t, type: "head_down_long" });
      }
      if (eyesClosed10sNow && !prev.eyesClosed10s) {
        eventsRef.current.push({ t, type: "eyes_closed_10s" });
      }

      // --- mandatory alarm: >10s continuous eye closure ---
      const shouldAlarm = eyesClosed10sNow && sample.state === "sleeping";
      const alarm = alarmRef.current;
      if (shouldAlarm && alarm && !alarm.isRunning()) {
        alarm.start();
        eventsRef.current.push({ t, type: "alarm_started" });
      } else if (!shouldAlarm && alarm && alarm.isRunning()) {
        alarm.stop();
        eventsRef.current.push({ t, type: "alarm_stopped" });
      }

      prevFlagsRef.current = {
        phoneDetected: phoneNow,
        eyesClosed10s: eyesClosed10sNow,
        lookingAwayLong: lookingAwayLongNow,
        headDownLong: headDownLongNow,
        alarmRunning: alarm?.isRunning() ?? false,
      };

      samplesRef.current.push({
        t: sessionMsRef.current,
        score: sample.score,
        state: sample.state,
        flags: flags
          ? {
              phoneDetected: flags.phoneDetected,
              lookingAway: flags.lookingAway,
              headDown: flags.headDown,
              eyesClosed: flags.eyesClosed,
              drowsy: flags.drowsy,
              hasFace: flags.hasFace,
            }
          : undefined,
      });
    },
    [running, paused],
  );

  const startSession = () => {
    if (!settings || !user) return;
    if (!alarmRef.current) alarmRef.current = createAlarmController();
    alarmRef.current.prime();
    samplesRef.current = [];
    eventsRef.current = [];
    focusMsRef.current = 0;
    breakMsRef.current = 0;
    sessionMsRef.current = 0;
    setFocusCompleted(0);
    prevFlagsRef.current = {
      phoneDetected: false,
      eyesClosed10s: false,
      lookingAwayLong: false,
      headDownLong: false,
      alarmRunning: false,
    };
    sessionStartedAtRef.current = new Date().toISOString();
    phaseRef.current = "focus";
    setPhase("focus");
    setRemainingSec(settings.focusMinutes * 60);
    setRunning(true);
    setPaused(false);
  };

  useEffect(() => {
    // Stop alarm when pausing / breaking / ending
    if (!running || paused || phase !== "focus") alarmRef.current?.stop();
  }, [running, paused, phase]);

  useEffect(() => {
    return () => {
      alarmRef.current?.close();
      alarmRef.current = null;
    };
  }, []);

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
      <div className="session-page flex min-h-[45vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-primary/25 dark:bg-cyan-500/20" />
        <p className="text-sm text-muted">Loading your session settings…</p>
      </div>
    );
  }

  const timerRingR = 56;
  const timerCirc = 2 * Math.PI * timerRingR;
  const timerOffset = timerCirc * (1 - (running ? phaseProgress : 0) / 100);

  return (
    <div className="session-page relative space-y-8 md:space-y-10">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/16 blur-3xl dark:bg-cyan-500/14" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-success/14 blur-3xl dark:bg-emerald-500/12" />

      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-gradient-to-br from-white via-sky-50/80 to-[#eef6ff] p-6 shadow-[0_20px_60px_-28px_rgba(79,134,247,0.2)] ring-1 ring-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-gradient-to-br dark:from-[#080d16] dark:via-[#0f172a] dark:to-[#060a10] dark:shadow-[0_24px_70px_-32px_rgba(0,0,0,0.55)] dark:ring-0 md:p-8"
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/15 blur-3xl dark:bg-cyan-500/12" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-8">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.1] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Pomodoro
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-muted">
                {settings.focusMinutes} min focus · Settings
              </span>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-white/80 text-primary shadow-sm dark:border-white/10 dark:bg-slate-800/90 dark:text-cyan-300 sm:flex">
                <Brain className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-[clamp(1.65rem,3.5vw,2.5rem)] font-semibold leading-tight tracking-tight text-text">
                  Deep focus{" "}
                  <span className="bg-gradient-to-r from-primary via-sky-500 to-emerald-500 bg-clip-text text-transparent dark:from-sky-300 dark:via-cyan-300 dark:to-emerald-400">
                    cockpit
                  </span>
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-muted md:text-[15px] md:leading-relaxed">
                  Timer, breaks, and optional live vision — eyes and face posture
                  blend into one calm focus score you can trust while you work.
                </p>
              </div>
            </div>
          </div>
          <div className="shrink-0 md:pt-1">
            {running ? (
              <Badge
                tone={phase === "focus" ? "blue" : "green"}
                className="px-3 py-1 text-xs"
              >
                {phase === "focus" ? "Focus block" : "Break"}
              </Badge>
            ) : (
              <Badge tone="muted" className="px-3 py-1 text-xs">
                Ready
              </Badge>
            )}
          </div>
        </div>
      </motion.header>

      <div className="relative grid gap-6 md:gap-8 xl:grid-cols-12">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.45,
            delay: 0.06,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="space-y-0 xl:col-span-7"
        >
          <Card
            className={cn(
              "overflow-hidden p-0",
              getLiveFlags(lastSample).flags?.phoneDetected
                ? "ring-2 ring-red-500/35"
                : null,
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10 md:px-6">
              <h2 className="flex items-center gap-3 text-base font-semibold tracking-tight text-text">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 text-primary dark:border-white/10 dark:bg-slate-800 dark:text-cyan-300">
                  <Video className="h-5 w-5" aria-hidden />
                </span>
                Live vision
              </h2>
              {!webcamEnabled ? (
                <Link
                  href="/settings"
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline dark:text-cyan-300"
                >
                  Enable camera in Settings
                </Link>
              ) : null}
            </div>
            <div className="p-5 md:p-6">
              <div className="overflow-hidden rounded-xl border border-slate-200/90 shadow-sm dark:border-white/10 dark:shadow-none">
                <FocusCamera
                  enabled={webcamEnabled}
                  active={running && !paused && phase === "focus"}
                  phoneDetectionEnabled={phoneDetectionEnabled}
                  focusThreshold={focusThreshold}
                  distractionThreshold={distractionThreshold}
                  onSample={onSample}
                />
              </div>
            </div>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.45,
            delay: 0.1,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="flex flex-col gap-5 xl:col-span-5"
        >
          <Card className="relative overflow-hidden p-0">
            <div className="pointer-events-none absolute -right-8 top-0 h-36 w-36 rounded-full bg-primary/12 blur-3xl dark:bg-cyan-500/12" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-28 rounded-full bg-success/10 blur-3xl dark:bg-emerald-500/10" />
            <div className="relative border-b border-slate-200/80 bg-gradient-to-r from-white/45 to-transparent px-6 py-4 backdrop-blur-md dark:border-white/10 dark:from-slate-900/40 dark:to-transparent">
              <div className="flex items-center gap-2 text-sm font-semibold text-text">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-primary/15 bg-white/90 text-primary dark:border-white/10 dark:bg-slate-800 dark:text-cyan-300">
                  <Timer className="h-4 w-4" aria-hidden />
                </span>
                Timer &amp; controls
              </div>
            </div>
            <div className="relative flex flex-col gap-5 p-6 md:flex-row md:items-start md:justify-between md:gap-6 md:p-7">
              <div className="relative mx-auto flex h-40 w-40 shrink-0 items-center justify-center md:mx-0">
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
                        ? "text-primary drop-shadow-[0_0_12px_rgba(79,134,247,0.35)] transition-[stroke-dashoffset] duration-1000 ease-out dark:text-cyan-400 dark:drop-shadow-[0_0_14px_rgba(34,211,238,0.25)]"
                        : "text-success drop-shadow-[0_0_12px_rgba(72,187,120,0.3)] transition-[stroke-dashoffset] duration-1000 ease-out dark:text-emerald-400"
                    }
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-muted">
                    {running ? (phase === "focus" ? "Focus" : "Break") : "Timer"}
                  </p>
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-text sm:text-4xl">
                    {running ? fmt(remainingSec) : "—"}
                  </p>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-4 text-center md:text-left">
                <Progress
                  value={running ? phaseProgress : 0}
                  className="h-2 rounded-full"
                />
                <p className="text-xs leading-relaxed text-slate-600 dark:text-muted">
                  Blocks done{" "}
                  <span className="font-semibold tabular-nums text-text">
                    {focusCompleted}
                  </span>{" "}
                  · long break every{" "}
                  <span className="font-semibold text-text">{longEvery}</span>
                </p>
                <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                  {!running ? (
                    <Button
                      type="button"
                      className="px-8 shadow-[0_10px_32px_-10px_rgba(79,134,247,0.45)] dark:shadow-[0_10px_32px_-10px_rgba(34,211,238,0.22)]"
                      onClick={startSession}
                    >
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

          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-200/80 bg-gradient-to-r from-primary/[0.06] to-transparent px-6 py-4 dark:border-white/10 dark:from-cyan-500/[0.08] dark:to-transparent">
              <h3 className="text-base font-semibold tracking-tight text-text">
                Live focus signal
              </h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-muted">
                Composite score from eyes + face
              </p>
            </div>
            <div className="space-y-5 p-6 md:p-7">
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
                  {(() => {
                    const { flags, durations } = getLiveFlags(lastSample);
                    const eyesClosedMs = durations?.eyesClosedMs ?? 0;
                    const eyesClosed = flags?.eyesClosed === true;
                    const toSleepSec =
                      eyesClosed && eyesClosedMs > 0
                        ? Math.max(0, Math.ceil((10_000 - eyesClosedMs) / 1000))
                        : null;

                    if (lastSample.state === "focused") return "Focused";
                    if (lastSample.state === "drifting") return "Drifting";
                    if (lastSample.state === "sleeping")
                      return "Sleeping (Alarm)";
                    if (eyesClosed && toSleepSec != null)
                      return `Eyes closed (${toSleepSec}s)`;
                    if (lastSample.state === "distracted") return "Not Focused";
                    if (lastSample.state === "away") return "Not Focused";
                    return lastSample.state;
                  })()}
                </Badge>
                <FocusSignalBars
                  eyesScore={lastSample.eyesScore}
                  faceScore={lastSample.faceScore}
                />

                {(() => {
                  const { flags, durations } = getLiveFlags(lastSample);
                  const phoneDetected = flags?.phoneDetected === true;
                  const eyesClosedMs = durations?.eyesClosedMs ?? 0;
                  const eyesClosed = flags?.eyesClosed === true;
                  const closedPct = Math.min(
                    100,
                    Math.max(0, (eyesClosedMs / 10_000) * 100),
                  );
                  const toSleepSec =
                    eyesClosed && eyesClosedMs > 0
                      ? Math.max(0, Math.ceil((10_000 - eyesClosedMs) / 1000))
                      : null;
                  const sleepLabel =
                    lastSample.state === "sleeping"
                      ? "Sleeping"
                      : eyesClosed && toSleepSec != null
                        ? `Eyes closed · ${toSleepSec}s`
                        : "Eyes open";

                  return (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div
                        className={cn(
                          "rounded-xl border p-3 backdrop-blur-xl backdrop-saturate-200",
                          phoneDetected
                            ? "border-red-500/40 bg-red-500/[0.10] dark:border-red-500/30 dark:bg-red-950/40"
                            : "border-white/55 bg-white/[0.28] dark:border-white/[0.16] dark:bg-slate-900/[0.36]",
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "text-xs font-semibold uppercase tracking-wide",
                              phoneDetected
                                ? "text-red-600 dark:text-red-300"
                                : "text-muted",
                            )}
                          >
                            Phone
                          </span>
                          <span className="tabular-nums text-xs font-semibold text-text">
                            {phoneDetected ? "Detected" : "—"}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full border border-white/25 bg-white/50 backdrop-blur-sm dark:border-white/[0.06] dark:bg-slate-800/60">
                          <div
                            className={cn(
                              "h-full rounded-full transition-[width] duration-200",
                              phoneDetected
                                ? "bg-gradient-to-r from-red-500 to-rose-500"
                                : "bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700",
                            )}
                            style={{ width: `${phoneDetected ? 100 : 0}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[10px] leading-snug text-muted">
                          MediaPipe phone detector — works portrait or sideways; marks Not Focused when a phone appears in frame.
                        </p>
                      </div>

                      <div
                        className={cn(
                          "rounded-xl border p-3 backdrop-blur-xl backdrop-saturate-200",
                          lastSample.state === "sleeping"
                            ? "border-red-500/40 bg-red-500/[0.10] dark:border-red-500/30 dark:bg-red-950/40"
                            : eyesClosed
                              ? "border-amber-500/40 bg-amber-500/[0.10] dark:border-amber-500/25 dark:bg-amber-950/35"
                              : "border-white/55 bg-white/[0.28] dark:border-white/[0.16] dark:bg-slate-900/[0.36]",
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "text-xs font-semibold uppercase tracking-wide",
                              lastSample.state === "sleeping"
                                ? "text-red-600 dark:text-red-300"
                                : eyesClosed
                                  ? "text-amber-700 dark:text-amber-300"
                                  : "text-muted",
                            )}
                          >
                            Sleep
                          </span>
                          <span className="tabular-nums text-xs font-semibold text-text">
                            {sleepLabel}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full border border-white/25 bg-white/50 backdrop-blur-sm dark:border-white/[0.06] dark:bg-slate-800/60">
                          <div
                            className={cn(
                              "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
                              lastSample.state === "sleeping"
                                ? "bg-gradient-to-r from-red-500 to-rose-500"
                                : eyesClosed
                                  ? "bg-gradient-to-r from-amber-500 to-yellow-500"
                                  : "bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700",
                            )}
                            style={{ width: `${eyesClosed ? closedPct : 0}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[10px] leading-snug text-muted">
                          Short blinks are ignored; progress starts after sustained
                          closure. Sleeping triggers at{" "}
                          <span className="font-medium text-text">10s</span>{" "}
                          continuous closure.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <p className="rounded-xl border border-slate-200/70 bg-slate-50/50 px-4 py-3 text-center text-[11px] leading-relaxed text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-muted">
                Score blends{" "}
                <span className="font-medium text-text">eyes</span> (~50%) and{" "}
                <span className="font-medium text-text">face</span> (~42%) with
                light expression dampening. Focused ≥{focusThreshold}% · drifting
                between · distracted &lt;{distractionThreshold}%.
              </p>
            </div>
          </Card>
        </motion.section>
      </div>

      {summary ? (
        <SessionSummaryCelebration
          summary={summary}
          celebration={summary.celebration}
          userName={user?.name ?? "Student"}
          userAvatarSeed={user?.id ?? "guest"}
          onClose={() => setSummary(null)}
        />
      ) : null}
    </div>
  );
}
