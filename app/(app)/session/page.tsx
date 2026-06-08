"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, BookOpen, ChevronRight, Sparkles, Users, Check } from "lucide-react";
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
import { FocusCameraPanel } from "@/components/library/FocusCameraPanel";
import { SessionTimerPanel } from "@/components/library/SessionTimerPanel";
import { LibraryHUD } from "@/components/library/LibraryHUD";
import { AvatarCreatorModal } from "@/components/library/AvatarCreatorModal";
import { useLibraryPresence } from "@/hooks/useLibraryPresence";
import type { LibraryFlowState } from "@/hooks/useLibraryPresence";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import type { PresenceStatus } from "@/lib/social/types";

const LibraryScene = dynamic(
  () => import("@/components/library/LibraryScene").then((m) => ({ default: m.LibraryScene })),
  { ssr: false, loading: () => <LibraryLoadingScreen /> },
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

function LibraryLoadingScreen() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#1a1206]">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-900/40 border border-amber-700/30">
        <BookOpen className="h-8 w-8 text-amber-400 animate-pulse" />
      </div>
      <p className="text-sm text-amber-200/60">Loading virtual library…</p>
    </div>
  );
}

const DURATION_OPTIONS = [
  { label: "25 min", value: 25 },
  { label: "50 min", value: 50 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
];

export default function SessionPage() {
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

  // Focus sample for live analytics + library presence
  const [lastSample, setLastSample] = useState<FocusFrameResult>({
    score: 0, state: "away", rawEar: 0, hasFace: false,
    eyesScore: 0, faceScore: 0, yaw: 0, pitch: 0,
  });

  const [summary, setSummary] = useState<SessionEndSummary | null>(null);

  // Load settings
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getSettings(user.id).then((s) => { if (!cancelled) setSettings(s); });
    return () => { cancelled = true; };
  }, [user]);

  // Load avatar URL from Supabase profile or localStorage
  useEffect(() => {
    if (!user || avatarChecked) return;
    const checkAvatar = async () => {
      let url: string | null = null;

      if (isSupabaseEnabled()) {
        try {
          const supabase = getSupabaseBrowser();
          const { data } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", user.id)
            .single();
          if (data?.avatar_url) url = data.avatar_url as string;
        } catch { /* ignore */ }
      }

      if (!url) {
        try { url = localStorage.getItem("studytime_avatar_url"); } catch { /* ignore */ }
      }

      setAvatarUrl(url);
      setAvatarChecked(true);

      if (!url) {
        // Delay slightly to let the library load first, then prompt.
        window.setTimeout(() => setShowAvatarCreator(true), 1500);
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

  // Keyboard dismiss summary
  useEffect(() => {
    if (!summary) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSummary(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [summary]);

  // Derived settings
  const focusSec = (settings?.focusMinutes ?? 25) * 60;
  const shortBreakSec = (settings?.shortBreakMinutes ?? 5) * 60;
  const longBreakSec = (settings?.longBreakMinutes ?? 15) * 60;
  const longEvery = settings?.longBreakEvery ?? 4;
  const focusThreshold = settings?.focusThreshold ?? 70;
  const distractionThreshold = settings?.distractionThreshold ?? 40;
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

  // Document title
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

  // Focus sample handler
  const onSample = useCallback((sample: FocusFrameResult) => {
    setLastSample(sample);
    if (!running || paused || phaseRef.current !== "focus") return;
    const flags = (sample as FocusFrameResult & {
      flags?: {
        phoneDetected?: boolean; eyesClosed?: boolean;
        lookingAway?: boolean; headDown?: boolean; drowsy?: boolean; hasFace?: boolean;
      };
    }).flags;
    const durations = (sample as FocusFrameResult & {
      durations?: { eyesClosedMs?: number; lookingAwayMs?: number; headDownMs?: number; phoneDetectedMs?: number; };
    }).durations;
    const t = sessionMsRef.current;
    const prev = prevFlagsRef.current;
    const phoneNow = flags?.phoneDetected === true;
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
    prevFlagsRef.current = { phoneDetected: phoneNow, eyesClosed10s: eyesClosed10sNow, lookingAwayLong: lookingAwayLongNow, headDownLong: headDownLongNow, alarmRunning: alarm?.isRunning() ?? false };
    samplesRef.current.push({
      t: sessionMsRef.current, score: sample.score, state: sample.state,
      flags: flags ? { phoneDetected: flags.phoneDetected, lookingAway: flags.lookingAway, headDown: flags.headDown, eyesClosed: flags.eyesClosed, drowsy: flags.drowsy, hasFace: flags.hasFace } : undefined,
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

  if (!user) {
    return <LibraryLoadingScreen />;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#1a1206]">
      {/* 3D Library Scene — full screen */}
      <div className="absolute inset-0">
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
        />
      </div>

      {/* === HUD (top-left) === */}
      <LibraryHUD studyingCount={studyingCount + 1} />

      {/* === Avatar Creator Modal === */}
      {showAvatarCreator && (
        <AvatarCreatorModal onAvatarSaved={handleAvatarSaved} onSkip={handleSkipAvatar} />
      )}

      {/* === Flow overlays === */}
      <AnimatePresence>
        {/* ENTERING — brief welcome */}
        {flowState === "entering" && (
          <motion.div
            key="entering"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3"
          >
            <div className="rounded-2xl border border-amber-500/20 bg-black/60 px-8 py-6 text-center backdrop-blur-xl">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-amber-400" />
              <h1 className="text-2xl font-bold text-white">Virtual Library</h1>
              <p className="mt-1 text-sm text-amber-200/60">Click an empty seat to begin</p>
            </div>
          </motion.div>
        )}

        {/* SEAT SELECT — instruction banner */}
        {flowState === "seat_select" && (
          <motion.div
            key="seat_select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-slate-900/90 px-6 py-3 shadow-2xl backdrop-blur-xl">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <BookOpen className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-white">
                Click a glowing seat to sit down
              </span>
            </div>
          </motion.div>
        )}

        {/* DURATION SELECT — picker overlay */}
        {flowState === "duration_select" && (
          <motion.div
            key="duration_select"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20">
                  <Clock className="h-5 w-5 text-sky-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white">Choose study duration</h2>
                  <p className="text-xs text-slate-400">Your avatar is seated and ready</p>
                </div>
              </div>

              {/* Preset durations */}
              <div className="mb-4 grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedDuration(opt.value)}
                    className={cn(
                      "rounded-xl border py-3 text-sm font-semibold transition-all",
                      selectedDuration === opt.value
                        ? "border-sky-500/50 bg-sky-500/20 text-sky-300"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Custom duration */}
              <div className="mb-5">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Custom (minutes)
                </label>
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
                  placeholder="e.g. 90"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setFlowState("seat_select"); setSelectedSeatId(null); }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Change seat
                </button>
                <button
                  onClick={startSession}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-500 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Start {selectedDuration}m session
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STUDYING — active session overlays */}
        {flowState === "studying" && running && (
          <motion.div
            key="studying_ui"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Focus camera — floating draggable */}
            <FocusCameraPanel
              enabled={webcamEnabled}
              active={running && !paused && phase === "focus"}
              phoneDetectionEnabled={phoneDetectionEnabled}
              focusThreshold={focusThreshold}
              distractionThreshold={distractionThreshold}
              onSample={onSample}
            />

            {/* Timer — bottom right */}
            <SessionTimerPanel
              running={running}
              paused={paused}
              phase={phase}
              remainingSec={remainingSec}
              phaseTotalSec={phaseTotalSec}
              focusCompleted={focusCompleted}
              onPause={() => setPaused(true)}
              onResume={() => setPaused(false)}
              onEnd={() => void endSession()}
            />

            {/* Focus score badge — top center */}
            <div className="absolute left-1/2 top-4 -translate-x-1/2 z-[60]">
              <div className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold backdrop-blur-xl shadow",
                lastSample.state === "focused"
                  ? "border-sky-500/40 bg-sky-900/80 text-sky-200"
                  : lastSample.state === "drifting"
                  ? "border-amber-500/40 bg-amber-900/80 text-amber-200"
                  : "border-red-500/40 bg-red-900/80 text-red-200",
              )}>
                <span className={cn(
                  "h-2 w-2 animate-pulse rounded-full",
                  lastSample.state === "focused" ? "bg-sky-400"
                  : lastSample.state === "drifting" ? "bg-amber-400"
                  : "bg-red-400",
                )} />
                Focus {Math.round(lastSample.score)}%
                {phase === "break" && (
                  <span className="ml-1 rounded-full bg-emerald-700/60 px-2 text-emerald-300 text-xs">Break</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session summary celebration */}
      {summary && (
        <SessionSummaryCelebration
          summary={summary}
          celebration={summary.celebration}
          userName={user?.name ?? "Student"}
          userAvatarSeed={user?.id ?? "guest"}
          onClose={() => {
            setSummary(null);
            setFlowState("seat_select");
            setSelectedSeatId(null);
          }}
        />
      )}
    </div>
  );
}
