"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Clock, BookOpen, ChevronRight, Sparkles, Check, ArrowLeft, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSessionLive } from "@/contexts/session-live-context";
import { useProgression } from "@/contexts/progression-context";
import { SessionSummaryCelebration } from "@/components/gamification/SessionSummaryCelebration";
import { computeSessionStats, persistStudySession } from "@/hooks/useStudySession";
import type { SessionCelebrationPayload } from "@/lib/gamification/session-celebration";
import { computeSessionCelebration } from "@/lib/gamification/session-celebration";
import type { FocusFrameResult } from "@/lib/focus-detection";
import { getSettings } from "@/lib/storage";
import type { FocusSample, SessionEvent, UserSettings } from "@/lib/types";
import { cn } from "@/lib/cn";
import { SessionEnterOverlay } from "@/components/library/SessionEnterOverlay";
import { SessionPanelsLayer } from "@/components/library/SessionPanelsLayer";
import { SessionTopBar } from "@/components/library/SessionTopBar";
import {
  SESSION_EASE,
  sessionPanelsEnter,
  sessionSceneEnter,
  sessionTopBarEnter,
  sessionWelcomeContainer,
  sessionWelcomeItem,
} from "@/lib/library/session-motion";
import {
  LibraryIconButton,
  LibraryPanelHeader,
  SessionFlowHint,
  SessionStepIndicator,
} from "@/components/library/SessionChrome";
import { AvatarCreator } from "@/components/library/AvatarCreator";
import { useLibraryPresence } from "@/hooks/useLibraryPresence";
import type { LibraryFlowState } from "@/hooks/useLibraryPresence";
import { loadAvatarUrl } from "@/lib/library/persist-avatar";
import { getSeatById } from "@/lib/library/seats";
import type { PresenceStatus } from "@/lib/social/types";
import { useSessionImmersive } from "@/hooks/useSessionImmersive";

const LibraryScene = dynamic(
  () => import("@/components/library/LibraryScene").then((m) => ({ default: m.LibraryScene })),
  { ssr: false, loading: () => <LibraryLoadingScreen embedded /> },
);

type Phase = "focus" | "break";

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
      try { await ctx.resume(); } catch { /* ignore */ }
    }
  };

  const teardownNodes = () => {
    try { osc1?.stop(); } catch { /* ignore */ }
    try { osc2?.stop(); } catch { /* ignore */ }
    try { lfo?.stop(); } catch { /* ignore */ }
    osc1?.disconnect(); osc2?.disconnect();
    lfo?.disconnect(); lfoGain?.disconnect(); gain?.disconnect();
    osc1 = null; osc2 = null; gain = null; lfo = null; lfoGain = null;
  };

  return {
    prime: () => { void ensure(); },
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
        osc1 = ctx.createOscillator(); osc1.type = "square"; osc1.frequency.value = 880; osc1.connect(gain);
        osc2 = ctx.createOscillator(); osc2.type = "sawtooth"; osc2.frequency.value = 1320; osc2.connect(gain);
        lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 2.6;
        lfoGain = ctx.createGain(); lfoGain.gain.value = 0.45;
        lfo.connect(lfoGain); lfoGain.connect(gain.gain);
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.7, now + 0.03);
        osc1.start(); osc2.start(); lfo.start();
      })();
    },
    stop: () => {
      if (!running) return;
      running = false;
      if (!ctx || !gain) { teardownNodes(); return; }
      const now = ctx.currentTime;
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0.0, now + 0.08);
      } catch { /* ignore */ }
      window.setTimeout(() => teardownNodes(), 120);
    },
    isRunning: () => running,
    close: () => {
      running = false;
      teardownNodes();
      if (ctx) { void ctx.close(); ctx = null; }
    },
  };
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function LibraryLoadingScreen({ embedded = false }: { embedded?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-4 bg-[#1a1206]",
        embedded ? "h-full min-h-[min(720px,calc(100dvh-5.5rem))] rounded-2xl" : "h-screen",
      )}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: SESSION_EASE }}
    >
      <motion.div
        className="library-glass-panel flex h-16 w-16 items-center justify-center"
        initial={reduce ? false : { opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.08, ease: SESSION_EASE }}
      >
        <BookOpen className="h-8 w-8 animate-pulse text-amber-300" />
      </motion.div>
      <motion.p
        className="text-sm text-slate-300"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.16, ease: SESSION_EASE }}
      >
        Loading virtual library…
      </motion.p>
    </motion.div>
  );
}

const DURATION_OPTIONS = [
  { label: "25 min", value: 25 },
  { label: "50 min", value: 50 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
];

export default function SessionPage() {
  const reduce = useReducedMotion();
  const { isImmersive, toggleImmersive, exitImmersive, layoutTransition } =
    useSessionImmersive();
  const { user } = useAuth();
  const { setLive, resetLive } = useSessionLive();
  const { refresh: refreshProgression } = useProgression();

  // Settings
  const [settings, setSettings] = useState<UserSettings | null>(null);

  // Flow state
  const [flowState, setFlowState] = useState<LibraryFlowState>("entering");
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(25);
  const [customDuration, setCustomDuration] = useState<string>("");

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showAvatarCreator, setShowAvatarCreator] = useState(false);
  const [avatarChecked, setAvatarChecked] = useState(false);

  // Timer / session
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<Phase>("focus");
  const [remainingSec, setRemainingSec] = useState(0);
  const [focusCompleted, setFocusCompleted] = useState(0);
  const samplesRef = useRef<FocusSample[]>([]);
  const eventsRef = useRef<SessionEvent[]>([]);
  const alarmRef = useRef<AlarmController | null>(null);
  const prevFlagsRef = useRef({
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
  const focusCompletedRef = useRef(0);

  type LiveFocusFlags = {
    phoneDetected?: boolean;
    lookingAway?: boolean;
    headDown?: boolean;
    eyesClosed?: boolean;
    hasFace?: boolean;
  };

  // Focus sample for live analytics + library presence
  const [lastSample, setLastSample] = useState<FocusFrameResult>({
    score: 0, state: "away", rawEar: 0, hasFace: false,
    eyesScore: 0, faceScore: 0, yaw: 0, pitch: 0,
  });
  const [liveFocusFlags, setLiveFocusFlags] = useState<LiveFocusFlags>({});
  const [eyesClosedMs, setEyesClosedMs] = useState(0);
  const [alarmRunning, setAlarmRunning] = useState(false);

  const [summary, setSummary] = useState<SessionEndSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const panelsLayerRef = useRef<HTMLDivElement>(null);

  // Load settings
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getSettings(user.id).then((s) => { if (!cancelled) setSettings(s); });
    return () => { cancelled = true; };
  }, [user]);

  // Load avatar URL — only prompt creator for new users without a saved avatar.
  useEffect(() => {
    if (!user || avatarChecked) return;
    const checkAvatar = async () => {
      const url = await loadAvatarUrl(user.id);
      setAvatarUrl(url);
      setAvatarChecked(true);

      if (!url) {
        window.setTimeout(() => setShowAvatarCreator(true), 1200);
      }
    };
    void checkAvatar();
  }, [user, avatarChecked]);

  // Transition to seat_select after entering
  useEffect(() => {
    if (flowState === "entering" && avatarChecked && !showAvatarCreator) {
      const t = window.setTimeout(() => setFlowState("seat_select"), 800);
      return () => clearTimeout(t);
    }
  }, [flowState, avatarChecked, showAvatarCreator]);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { focusCompletedRef.current = focusCompleted; }, [focusCompleted]);

  const closeSummary = useCallback(() => {
    setSummaryOpen(false);
    window.setTimeout(() => {
      setSummary(null);
      setFlowState("seat_select");
      setSelectedSeatId(null);
    }, 280);
  }, []);

  // Keyboard: Escape exits immersive mode (summary modal handles its own Escape)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || summaryOpen) return;
      if (isImmersive) exitImmersive();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [summaryOpen, isImmersive, exitImmersive]);

  // Derived settings
  const focusSec = (settings?.focusMinutes ?? 25) * 60;
  const shortBreakSec = (settings?.shortBreakMinutes ?? 5) * 60;
  const longBreakSec = (settings?.longBreakMinutes ?? 15) * 60;
  const longEvery = settings?.longBreakEvery ?? 4;
  const focusThreshold = settings?.focusThreshold ?? 70;
  const distractionThreshold = settings?.distractionThreshold ?? 40;
  const focusSensitivity = settings?.focusSensitivity ?? "balanced";
  const deskWorkBias = settings?.deskWorkBias ?? true;
  const webcamEnabled = settings?.webcamEnabled ?? true;
  const phoneDetectionEnabled = settings?.phoneDetectionEnabled ?? true;

  const completeCurrentPhaseRef = useRef<() => void>(() => {});
  const completeCurrentPhase = useCallback(() => {
    if (phaseRef.current === "focus") {
      setFocusCompleted((c) => {
        const next = c + 1;
        const isLong = next > 0 && next % longEvery === 0;
        setRemainingSec(isLong ? longBreakSec : shortBreakSec);
        return next;
      });
      phaseRef.current = "break";
      setPhase("break");
    } else {
      phaseRef.current = "focus";
      setPhase("focus");
      setRemainingSec(focusSec);
    }
  }, [focusSec, longBreakSec, longEvery, shortBreakSec]);

  completeCurrentPhaseRef.current = completeCurrentPhase;

  const endSession = useCallback(async () => {
    alarmRef.current?.stop();
    const started = sessionStartedAtRef.current;
    const samples = [...samplesRef.current];
    const focusMs = focusMsRef.current;
    const breakMs = breakMsRef.current;
    const blocks = focusCompletedRef.current;
    const endedAt = new Date().toISOString();
    const stats = computeSessionStats(samples, focusThreshold, focusMs, breakMs);
    let saved = false;
    let celebration: SessionCelebrationPayload | null = null;
    if (user && started && samples.length > 0) {
      const session = await persistStudySession(
        user.id, started, samples, [...eventsRef.current], focusMs, breakMs, focusThreshold,
      );
      saved = true;
      try { celebration = await computeSessionCelebration(user, session); } catch { celebration = null; }
    }
    setRunning(false);
    setPaused(false);
    resetLive();
    if (typeof document !== "undefined") document.title = "StudyTime";
    sessionStartedAtRef.current = null;
    samplesRef.current = []; eventsRef.current = [];
    focusMsRef.current = 0; breakMsRef.current = 0; sessionMsRef.current = 0;
    setFocusCompleted(0);
    phaseRef.current = "focus"; setPhase("focus"); setRemainingSec(0);
    setFlowState("session_end");
    setSummary({
      saved, startedAt: started ?? endedAt, endedAt, focusMs, breakMs,
      pomodoroBlocks: blocks, sampleCount: samples.length,
      averageFocus: stats.averageFocus, focusedRatio: stats.focusedRatio,
      distractionEvents: stats.distractionEvents, celebration,
    });
    setSummaryOpen(true);
    if (saved) void refreshProgression();
  }, [focusThreshold, resetLive, user, refreshProgression]);

  // Timer tick
  useEffect(() => {
    if (!running || paused) return;
    const id = window.setInterval(() => {
      setRemainingSec((s) => {
        if (s <= 0) return s;
        sessionMsRef.current += 1000;
        if (phaseRef.current === "focus") focusMsRef.current += 1000;
        else breakMsRef.current += 1000;
        if (s === 1) { queueMicrotask(() => completeCurrentPhaseRef.current()); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, paused]);

  // Tab title — keep timer visible when user switches away from the tab
  useEffect(() => {
    if (!running) return;
    document.title = phase === "focus"
      ? `Focus ${fmt(remainingSec)} · StudyTime`
      : `Break ${fmt(remainingSec)} · StudyTime`;
  }, [running, phase, remainingSec]);

  // Session live context
  useEffect(() => {
    setLive({
      running, phase,
      focusState: phase === "focus" ? lastSample.state : null,
      score: phase === "focus" ? lastSample.score : null,
    });
  }, [running, phase, lastSample, setLive]);

  useEffect(() => () => resetLive(), [resetLive]);

  // Timestamp of the last time we pushed UI state updates from onSample.
  // Analytics (samplesRef) still run on every tick; only the rendered numbers
  // are throttled to ~1 Hz so the React tree doesn't churn at 2.5 Hz.
  const lastUiUpdateMsRef = useRef<number>(0);
  const UI_THROTTLE_MS = 900;

  // Focus sample handler
  const onSample = useCallback((sample: FocusFrameResult) => {
    const flags = (sample as FocusFrameResult & {
      flags?: LiveFocusFlags;
    }).flags;
    const durations = (sample as FocusFrameResult & {
      durations?: { eyesClosedMs?: number; lookingAwayMs?: number; headDownMs?: number; phoneDetectedMs?: number };
    }).durations;

    // Throttle purely visual state updates so the React tree
    // (panels, context, 3D badge) re-renders at ~1 Hz on low-spec machines.
    const nowMs = Date.now();
    if (nowMs - lastUiUpdateMsRef.current >= UI_THROTTLE_MS) {
      lastUiUpdateMsRef.current = nowMs;
      setLastSample(sample);
      setLiveFocusFlags({
        phoneDetected: flags?.phoneDetected,
        lookingAway: flags?.lookingAway,
        headDown: flags?.headDown,
        eyesClosed: flags?.eyesClosed,
        hasFace: flags?.hasFace ?? sample.hasFace,
      });
      setEyesClosedMs(durations?.eyesClosedMs ?? 0);
      setAlarmRunning(alarmRef.current?.isRunning() ?? false);
    }

    if (!running || paused || phaseRef.current !== "focus") return;
    const sampleFlags = (sample as FocusFrameResult & {
      flags?: {
        phoneDetected?: boolean; eyesClosed?: boolean;
        lookingAway?: boolean; headDown?: boolean; drowsy?: boolean; hasFace?: boolean;
      };
    }).flags ?? flags;
    const t = sessionMsRef.current;
    const prev = prevFlagsRef.current;
    const phoneNow = sampleFlags?.phoneDetected === true;
    const eyesClosed10sNow = (durations?.eyesClosedMs ?? 0) >= 10_000;
    const lookingAwayLongNow = (durations?.lookingAwayMs ?? 0) >= 6_000;
    const headDownLongNow = (durations?.headDownMs ?? 0) >= 4_500;
    if (phoneNow && !prev.phoneDetected) eventsRef.current.push({ t, type: "phone_detected" });
    if (lookingAwayLongNow && !prev.lookingAwayLong) eventsRef.current.push({ t, type: "look_away_long" });
    if (headDownLongNow && !prev.headDownLong) eventsRef.current.push({ t, type: "head_down_long" });
    if (eyesClosed10sNow && !prev.eyesClosed10s) eventsRef.current.push({ t, type: "eyes_closed_10s" });
    const shouldAlarm = eyesClosed10sNow && sample.state === "sleeping";
    const alarm = alarmRef.current;
    if (shouldAlarm && alarm && !alarm.isRunning()) { alarm.start(); eventsRef.current.push({ t, type: "alarm_started" }); }
    else if (!shouldAlarm && alarm && alarm.isRunning()) { alarm.stop(); eventsRef.current.push({ t, type: "alarm_stopped" }); }
    setAlarmRunning(alarm?.isRunning() ?? false);
    prevFlagsRef.current = { phoneDetected: phoneNow, eyesClosed10s: eyesClosed10sNow, lookingAwayLong: lookingAwayLongNow, headDownLong: headDownLongNow, alarmRunning: alarm?.isRunning() ?? false };
    samplesRef.current.push({
      t: sessionMsRef.current, score: sample.score, state: sample.state,
      flags: sampleFlags ? { phoneDetected: sampleFlags.phoneDetected, lookingAway: sampleFlags.lookingAway, headDown: sampleFlags.headDown, eyesClosed: sampleFlags.eyesClosed, drowsy: (sampleFlags as { drowsy?: boolean }).drowsy, hasFace: sampleFlags.hasFace } : undefined,
    });
  }, [running, paused]);

  // Alarm cleanup
  useEffect(() => {
    if (!running || paused || phase !== "focus") alarmRef.current?.stop();
  }, [running, paused, phase]);
  useEffect(() => () => { alarmRef.current?.close(); alarmRef.current = null; }, []);

  const startSession = useCallback(() => {
    if (!user) return;
    if (!alarmRef.current) alarmRef.current = createAlarmController();
    alarmRef.current.prime();
    samplesRef.current = []; eventsRef.current = [];
    focusMsRef.current = 0; breakMsRef.current = 0; sessionMsRef.current = 0;
    setFocusCompleted(0);
    prevFlagsRef.current = { phoneDetected: false, eyesClosed10s: false, lookingAwayLong: false, headDownLong: false, alarmRunning: false };
    sessionStartedAtRef.current = new Date().toISOString();
    phaseRef.current = "focus"; setPhase("focus");
    setRemainingSec(selectedDuration * 60);
    setRunning(true);
    setPaused(false);
    setFlowState("studying");
  }, [user, selectedDuration]);

  // Phase progress for timer ring
  const phaseTotalSec = useMemo(() => {
    if (phase === "focus") return selectedDuration * 60;
    const isLong = focusCompleted > 0 && focusCompleted % longEvery === 0;
    return isLong ? longBreakSec : shortBreakSec;
  }, [phase, selectedDuration, shortBreakSec, longBreakSec, longEvery, focusCompleted]);

  // Library presence
  const libraryStatus: PresenceStatus | "completed" =
    flowState === "session_end" ? "completed"
    : running ? "studying"
    : "online";

  const { peers, studyingCount } = useLibraryPresence({
    userId: user?.id ?? null,
    displayName: user?.name ?? "Student",
    avatarUrl,
    seatId: selectedSeatId,
    status: libraryStatus,
    focusPhase: running ? phase : null,
    focusScore: lastSample.score,
    sessionDurationMs: sessionMsRef.current,
  });

  const handleSeatClick = useCallback((seatId: string) => {
    setSelectedSeatId(seatId);
    setFlowState("duration_select");
  }, []);

  const handleAvatarSaved = useCallback((url: string) => {
    setAvatarUrl(url);
    setShowAvatarCreator(false);
  }, []);

  const handleSkipAvatar = useCallback(() => {
    setShowAvatarCreator(false);
  }, []);

  const selectedSeat = useMemo(
    () => (selectedSeatId ? getSeatById(selectedSeatId) : null),
    [selectedSeatId],
  );

  const panelLayout = isImmersive ? "immersive" : "embedded";
  const stepBannerTop = isImmersive
    ? "top-[5.25rem]"
    : "top-[4.25rem] sm:top-[4.75rem]";

  if (!user) {
    return <LibraryLoadingScreen embedded />;
  }

  return (
    <motion.div
      layout
      className={cn(
        "overflow-hidden bg-[#1a1206]",
        isImmersive
          ? "fixed inset-0 z-[200]"
          : "relative min-h-[min(720px,calc(100dvh-5.5rem))] w-full flex-1 rounded-2xl ring-1 ring-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.35)]",
      )}
      initial={false}
      animate={{
        borderRadius: isImmersive ? 0 : 16,
        opacity: 1,
      }}
      transition={layoutTransition}
    >
      <SessionEnterOverlay />

      {/* 3D Library Scene — full screen */}
      <motion.div
        className="absolute inset-0"
        initial={reduce ? false : sessionSceneEnter.initial}
        animate={sessionSceneEnter.animate}
        transition={reduce ? { duration: 0.01 } : sessionSceneEnter.transition}
      >
        <LibraryScene
          flowState={flowState}
          myAvatarUrl={avatarUrl}
          mySeatId={selectedSeatId}
          myStatus={
            flowState === "session_end" ? "completed"
            : running && phase === "break" ? "break"
            : running ? "studying"
            : "idle"
          }
          myFocusScore={lastSample.score}
          peers={peers}
          onSeatClick={handleSeatClick}
          userName={user.name ?? "You"}
          userId={user.id}
        />
      </motion.div>

      {/* === Top bar: room info + dashboard exit === */}
      {!showAvatarCreator && !summary && (
        <motion.div
          className="absolute inset-x-0 top-0"
          initial={reduce ? false : sessionTopBarEnter.initial}
          animate={sessionTopBarEnter.animate}
          transition={reduce ? { duration: 0.01 } : sessionTopBarEnter.transition}
        >
          <SessionTopBar
            studyingCount={studyingCount}
            isImmersive={isImmersive}
            onToggleImmersive={toggleImmersive}
          />
        </motion.div>
      )}

      {/* === Avatar Creator (full-screen, new users only) === */}
      {showAvatarCreator && (
        <AvatarCreator
          key={avatarUrl ?? "new"}
          initialAvatarUrl={avatarUrl}
          onAvatarSaved={handleAvatarSaved}
          onClose={handleSkipAvatar}
          showSkip
        />
      )}

      {/* === Flow overlays === */}
      <AnimatePresence>
        {/* ENTERING — brief welcome */}
        {flowState === "entering" && (
          <motion.div
            key="entering"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{ duration: 0.65, ease: SESSION_EASE }}
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3"
          >
            <motion.div
              className="library-glass-panel border-amber-500/20 px-8 py-6 text-center"
              variants={sessionWelcomeContainer}
              initial="initial"
              animate="animate"
            >
              <motion.div variants={sessionWelcomeItem}>
                <BookOpen className="mx-auto mb-3 h-10 w-10 text-amber-300" />
              </motion.div>
              <motion.h1
                variants={sessionWelcomeItem}
                className="text-2xl font-bold text-slate-50"
              >
                Virtual Library
              </motion.h1>
              <motion.p
                variants={sessionWelcomeItem}
                className="mt-1 text-sm text-slate-300"
              >
                Find a seat and start your focus session
              </motion.p>
            </motion.div>
          </motion.div>
        )}

        {/* SEAT SELECT — instruction banner */}
        {(flowState === "seat_select" || flowState === "duration_select") && (
          <motion.div
            key="session_steps"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "pointer-events-none absolute inset-x-0 z-[60] flex justify-center px-4",
              stepBannerTop,
            )}
          >
            <SessionStepIndicator
              active={flowState === "seat_select" ? "seat" : "duration"}
            />
          </motion.div>
        )}

        {flowState === "seat_select" && (
          <motion.div
            key="seat_select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-none absolute inset-x-0 bottom-6 z-[60] flex justify-center px-4"
          >
            <SessionFlowHint icon={<BookOpen className="h-4 w-4" />}>
              Click a glowing seat to sit down
            </SessionFlowHint>
          </motion.div>
        )}

        {/* DURATION SELECT — centered picker overlay */}
        {flowState === "duration_select" && (
          <motion.div
            key="duration_select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] isolate flex items-center justify-center bg-black/50 px-4 pt-16 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md"
            >
              <div className="library-glass-modal">
                <LibraryPanelHeader
                  icon={<Clock className="h-4 w-4 shrink-0 text-sky-300" />}
                  title="Choose study duration"
                  subtitle={
                    selectedSeat
                      ? `Seated at ${selectedSeat.label}`
                      : "Your avatar is seated and ready"
                  }
                  actions={
                    <LibraryIconButton
                      label="Back to seat selection"
                      onClick={() => {
                        setFlowState("seat_select");
                        setSelectedSeatId(null);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </LibraryIconButton>
                  }
                />

                <div className="p-6">
                  <p className="library-text-label mb-2.5">Quick picks</p>
                  <div className="mb-5 grid grid-cols-2 gap-2.5">
                    {DURATION_OPTIONS.map((opt) => {
                      const selected = selectedDuration === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setSelectedDuration(opt.value)}
                          className={cn(
                            "relative rounded-xl border py-3.5 text-sm font-semibold transition-all",
                            selected
                              ? "border-sky-400/60 bg-sky-500/15 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.12)]"
                              : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.08] hover:text-white",
                          )}
                        >
                          {selected && (
                            <Check className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-sky-400" />
                          )}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom duration */}
                  <p className="library-text-label mb-2">Custom length</p>
                  <div className="mb-6">
                    <input
                      type="number"
                      min={5}
                      max={480}
                      value={customDuration}
                      onChange={(e) => {
                        setCustomDuration(e.target.value);
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 5) setSelectedDuration(val);
                      }}
                      placeholder="Enter minutes (e.g. 90)"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-100 placeholder-slate-400 outline-none transition focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setFlowState("seat_select"); setSelectedSeatId(null); }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Change seat
                    </button>
                    <button
                      onClick={startSession}
                      className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/40 transition hover:bg-sky-500"
                    >
                      <Sparkles className="h-4 w-4" />
                      Start {selectedDuration}m session
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* STUDYING — floating panels above the 3D scene */}
      {flowState === "studying" && running && (
        <motion.div
          ref={panelsLayerRef}
          className="pointer-events-none absolute inset-0 z-30"
          initial={reduce ? false : sessionPanelsEnter.initial}
          animate={sessionPanelsEnter.animate}
          transition={reduce ? { duration: 0.01 } : sessionPanelsEnter.transition}
        >
          <SessionPanelsLayer
            webcamEnabled={webcamEnabled}
            active={running && !paused && phase === "focus"}
            phoneDetectionEnabled={phoneDetectionEnabled}
            focusThreshold={focusThreshold}
            distractionThreshold={distractionThreshold}
            focusSensitivity={focusSensitivity}
            deskWorkBias={deskWorkBias}
            onSample={onSample}
            running={running}
            paused={paused}
            phase={phase}
            remainingSec={remainingSec}
            phaseTotalSec={phaseTotalSec}
            focusCompleted={focusCompleted}
            onPause={() => setPaused(true)}
            onResume={() => setPaused(false)}
            onEnd={() => void endSession()}
            sample={lastSample}
            flags={liveFocusFlags}
            eyesClosedMs={eyesClosedMs}
            alarmRunning={alarmRunning}
            layout={panelLayout}
          />
        </motion.div>
      )}

      {/* Session summary celebration */}
      {summary ? (
        <SessionSummaryCelebration
          open={summaryOpen}
          summary={summary}
          celebration={summary.celebration}
          userName={user?.name ?? "Student"}
          userAvatarSeed={user?.id ?? "guest"}
          onClose={closeSummary}
        />
      ) : null}
    </motion.div>
  );
}
