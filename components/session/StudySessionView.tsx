"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Clock, BookOpen, ChevronRight, Sparkles, ArrowLeft, X, AlertTriangle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSessionLive } from "@/contexts/session-live-context";
import { useProgression } from "@/contexts/progression-context";
import { SessionSummaryCelebration } from "@/components/gamification/SessionSummaryCelebration";
import { computeSessionStats, persistStudySession } from "@/hooks/useStudySession";
import type { SessionCelebrationPayload } from "@/lib/gamification/session-celebration";
import { computeSessionCelebration } from "@/lib/gamification/session-celebration";
import type { FocusFrameResult } from "@/lib/focus-detection";
import {
  getSessionTimerSettings,
  getUserPreferences,
  saveSessionTimerSettings,
} from "@/lib/storage";
import type {
  FocusSample,
  MonitoringSnapshotEventType,
  SessionEvent,
  SessionTimerSettings,
  UserPreferences,
} from "@/lib/types";
import {
  uploadMonitoringSnapshots,
  type PendingMonitoringSnapshot,
} from "@/lib/room-monitoring";
import { DEFAULT_SESSION_TIMER_SETTINGS } from "@/lib/types";
import { SessionTimerConfig } from "@/components/session/SessionTimerConfig";
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
import { useLibraryRoomHeartbeat } from "@/hooks/useLibraryRoomHeartbeat";
import { loadAvatarUrl } from "@/lib/library/persist-avatar";
import { getSeatById } from "@/lib/library/seats";
import type { PresenceStatus } from "@/lib/social/types";
import { useSessionImmersive } from "@/hooks/useSessionImmersive";
import { SessionLibraryLobby } from "@/components/session/SessionLibraryLobby";

const LibraryScene = dynamic(
  () => import("@/components/library/LibraryScene").then((m) => ({ default: m.LibraryScene })),
  { ssr: false, loading: () => <LibraryLoadingScreen embedded /> },
);

type Phase = "focus" | "break";

type SessionEndSummary = {
  saved: boolean;
  celebrationPending: boolean;
  saveError: string | null;
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

export function LibraryLoadingScreen({ embedded = false }: { embedded?: boolean }) {
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

export type StudySessionPageProps = {
  libraryRoomId?: string;
  libraryRoomName?: string;
  libraryRoomRole?: "host" | "participant";
  libraryRoomParticipantLimit?: number;
  joinCode?: string;
  /** Participant agreed to host monitoring snapshots in this room. */
  monitoringConsented?: boolean;
};

export function StudySessionView({
  libraryRoomId,
  libraryRoomName = "Main Library",
  libraryRoomRole,
  libraryRoomParticipantLimit,
  joinCode,
  monitoringConsented = false,
}: StudySessionPageProps = {}) {
  const presenceRoomId = libraryRoomId ?? "main";
  const isPrivateRoom = Boolean(libraryRoomId);
  const reduce = useReducedMotion();
  const router = useRouter();
  const { isImmersive, toggleImmersive, exitImmersive, layoutTransition } =
    useSessionImmersive();
  const { user, signOut } = useAuth();
  const { setLive, resetLive, pendingNavDestination, clearPendingNav } = useSessionLive();
  const { refresh: refreshProgression } = useProgression();

  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [timerSettings, setTimerSettings] = useState<SessionTimerSettings>(
    DEFAULT_SESSION_TIMER_SETTINGS,
  );

  // Flow state
  const [flowState, setFlowState] = useState<LibraryFlowState>(
    isPrivateRoom ? "entering" : "library_select",
  );
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);

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
    away: false,
  });
  const frameCaptureRef = useRef<(() => Promise<Blob | null>) | null>(null);
  const pendingSnapshotsRef = useRef<PendingMonitoringSnapshot[]>([]);
  const snapshotThrottleRef = useRef<Record<string, number>>({});
  const monitoringActive =
    isPrivateRoom &&
    libraryRoomRole === "participant" &&
    monitoringConsented &&
    Boolean(libraryRoomId);
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
  const [endingSession, setEndingSession] = useState(false);
  const endingSessionRef = useRef(false);
  const panelsLayerRef = useRef<HTMLDivElement>(null);

  // Exit-confirmation dialog (shown when Sidebar/Topbar intercepts navigation)
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [pendingExitDest, setPendingExitDest] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void Promise.all([
      getUserPreferences(user.id),
      getSessionTimerSettings(user.id),
    ]).then(([prefs, timer]) => {
      if (!cancelled) {
        setPreferences(prefs);
        setTimerSettings(timer);
      }
    });
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

  // Transition to seat_select after entering (private rooms only)
  useEffect(() => {
    if (
      isPrivateRoom &&
      flowState === "entering" &&
      avatarChecked &&
      !showAvatarCreator
    ) {
      const t = window.setTimeout(() => setFlowState("seat_select"), 800);
      return () => clearTimeout(t);
    }
  }, [isPrivateRoom, flowState, avatarChecked, showAvatarCreator]);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { focusCompletedRef.current = focusCompleted; }, [focusCompleted]);

  const closeSummary = useCallback(() => {
    setSummaryOpen(false);
    window.setTimeout(() => {
      setSummary(null);
      const dest = pendingExitDest;
      if (dest) {
        setPendingExitDest(null);
        if (dest === "__logout__") {
          void signOut();
        } else if (dest === "__lobby__") {
          setFlowState("library_select");
          setSelectedSeatId(null);
        } else {
          router.push(dest);
        }
      } else {
        setFlowState(isPrivateRoom ? "seat_select" : "library_select");
        setSelectedSeatId(null);
      }
    }, 280);
  }, [pendingExitDest, isPrivateRoom, signOut, router]);

  const handleChangeLibrary = useCallback(() => {
    if (running) {
      setPendingExitDest("__lobby__");
      setExitDialogOpen(true);
      return;
    }
    setSelectedSeatId(null);
    setFlowState("library_select");
  }, [running]);

  // Keyboard: Escape exits immersive mode (summary modal handles its own Escape)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || summaryOpen) return;
      if (isImmersive) exitImmersive();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [summaryOpen, isImmersive, exitImmersive]);

  const focusSec = timerSettings.focusMinutes * 60;
  const shortBreakSec = timerSettings.shortBreakMinutes * 60;
  const longBreakSec = timerSettings.longBreakMinutes * 60;
  const longEvery = timerSettings.longBreakEvery;
  const webcamEnabled = preferences?.webcamEnabled ?? true;
  const phoneDetectionEnabled = preferences?.phoneDetectionEnabled ?? true;

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
    if (endingSessionRef.current) return;
    endingSessionRef.current = true;
    setEndingSession(true);

    alarmRef.current?.stop();
    const started = sessionStartedAtRef.current;
    const samples = [...samplesRef.current];
    const events = [...eventsRef.current];
    const focusMs = focusMsRef.current;
    const breakMs = breakMsRef.current;
    const blocks = focusCompletedRef.current;
    const endedAt = new Date().toISOString();
    const stats = computeSessionStats(samples, focusMs, breakMs);
    const shouldPersist = Boolean(user && started && samples.length > 0);

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
    setFlowState("session_end");
    setSummary({
      saved: false,
      celebrationPending: shouldPersist,
      saveError: null,
      startedAt: started ?? endedAt,
      endedAt,
      focusMs,
      breakMs,
      pomodoroBlocks: blocks,
      sampleCount: samples.length,
      averageFocus: stats.averageFocus,
      focusedRatio: stats.focusedRatio,
      distractionEvents: stats.distractionEvents,
      celebration: null,
    });
    setSummaryOpen(true);
    setEndingSession(false);
    endingSessionRef.current = false;

    if (!shouldPersist || !user || !started) return;

    const userSnapshot = user;
    const startedSnapshot = started;
    void (async () => {
      try {
        const session = await persistStudySession(
          userSnapshot.id,
          startedSnapshot,
          samples,
          events,
          focusMs,
          breakMs,
          libraryRoomId ?? null,
        );
        if (monitoringActive && libraryRoomId) {
          const snaps = [...pendingSnapshotsRef.current];
          pendingSnapshotsRef.current = [];
          void uploadMonitoringSnapshots(
            libraryRoomId,
            userSnapshot.id,
            session.id,
            snaps,
          );
        }
        setSummary((prev) => (prev ? { ...prev, saved: true } : prev));
        let celebration: SessionCelebrationPayload | null = null;
        try {
          celebration = await computeSessionCelebration(userSnapshot, session);
        } catch {
          celebration = null;
        }
        setSummary((prev) =>
          prev ? { ...prev, celebration, celebrationPending: false } : prev,
        );
        void refreshProgression();
      } catch (err) {
        setSummary((prev) =>
          prev
            ? {
                ...prev,
                celebrationPending: false,
                saveError:
                  err instanceof Error ? err.message : "Could not save session",
              }
            : prev,
        );
      }
    })();
  }, [libraryRoomId, resetLive, user, refreshProgression]);

  // ── Exit-guard: watch for navigation requests from Sidebar / Topbar ─────────
  useEffect(() => {
    if (!pendingNavDestination) return;
    // Snapshot the destination and clear it from the context immediately so
    // the signal is consumed only once.
    setPendingExitDest(pendingNavDestination);
    clearPendingNav();
    setExitDialogOpen(true);
  }, [pendingNavDestination, clearPendingNav]);

  // "Save & End" → run the full endSession flow (persists + shows summary).
  // When the summary modal is closed, closeSummary will navigate to pendingExitDest.
  const handleSaveAndExit = useCallback(async () => {
    setExitDialogOpen(false);
    await endSession();
    // pendingExitDest is read by closeSummary after the summary modal closes.
  }, [endSession]);

  // "Leave without saving" → hard-stop everything and navigate immediately.
  const handleExitWithoutSaving = useCallback(() => {
    setExitDialogOpen(false);
    const dest = pendingExitDest;
    setPendingExitDest(null);
    alarmRef.current?.stop();
    setRunning(false);
    setPaused(false);
    resetLive();
    if (typeof document !== "undefined") document.title = "StudyTime";
    if (dest === "__logout__") {
      void signOut();
    } else if (dest === "__lobby__") {
      setFlowState("library_select");
      setSelectedSeatId(null);
      samplesRef.current = [];
      eventsRef.current = [];
      sessionStartedAtRef.current = null;
    } else if (dest) {
      router.push(dest);
    }
  }, [pendingExitDest, resetLive, signOut, router]);

  const handleStayInSession = useCallback(() => {
    setExitDialogOpen(false);
    setPendingExitDest(null);
  }, []);

  // Block accidental tab-close / hard refresh while a session is running.
  useEffect(() => {
    if (!running) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [running]);

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

  const queueMonitoringSnapshot = useCallback(
    async (eventType: MonitoringSnapshotEventType, sessionTMs: number) => {
      if (!monitoringActive) return;
      const now = Date.now();
      const last = snapshotThrottleRef.current[eventType] ?? 0;
      if (now - last < 45_000) return;
      const capture = frameCaptureRef.current;
      if (!capture) return;
      const blob = await capture();
      if (!blob) return;
      snapshotThrottleRef.current[eventType] = now;
      pendingSnapshotsRef.current.push({ eventType, sessionTMs, blob });
    },
    [monitoringActive],
  );

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
    const awayNow = sample.state === "away";
    const eyesClosed10sNow = (durations?.eyesClosedMs ?? 0) >= 10_000;
    const lookingAwayLongNow = (durations?.lookingAwayMs ?? 0) >= 6_000;
    const headDownLongNow = (durations?.headDownMs ?? 0) >= 4_500;
    if (phoneNow && !prev.phoneDetected) {
      eventsRef.current.push({ t, type: "phone_detected" });
      void queueMonitoringSnapshot("phone_detected", t);
    }
    if (lookingAwayLongNow && !prev.lookingAwayLong) {
      eventsRef.current.push({ t, type: "look_away_long" });
      eventsRef.current.push({ t, type: "drift" });
      void queueMonitoringSnapshot("drift", t);
    }
    if (awayNow && !prev.away) {
      eventsRef.current.push({ t, type: "off_screen" });
      void queueMonitoringSnapshot("off_screen", t);
    }
    if (headDownLongNow && !prev.headDownLong) eventsRef.current.push({ t, type: "head_down_long" });
    if (eyesClosed10sNow && !prev.eyesClosed10s) eventsRef.current.push({ t, type: "eyes_closed_10s" });
    const shouldAlarm = eyesClosed10sNow && sample.state === "sleeping";
    const alarm = alarmRef.current;
    if (shouldAlarm && alarm && !alarm.isRunning()) { alarm.start(); eventsRef.current.push({ t, type: "alarm_started" }); }
    else if (!shouldAlarm && alarm && alarm.isRunning()) { alarm.stop(); eventsRef.current.push({ t, type: "alarm_stopped" }); }
    setAlarmRunning(alarm?.isRunning() ?? false);
    prevFlagsRef.current = {
      phoneDetected: phoneNow,
      eyesClosed10s: eyesClosed10sNow,
      lookingAwayLong: lookingAwayLongNow,
      headDownLong: headDownLongNow,
      alarmRunning: alarm?.isRunning() ?? false,
      away: awayNow,
    };
    samplesRef.current.push({
      t: sessionMsRef.current, score: sample.score, state: sample.state,
      flags: sampleFlags ? { phoneDetected: sampleFlags.phoneDetected, lookingAway: sampleFlags.lookingAway, headDown: sampleFlags.headDown, eyesClosed: sampleFlags.eyesClosed, drowsy: (sampleFlags as { drowsy?: boolean }).drowsy, hasFace: sampleFlags.hasFace } : undefined,
    });
  }, [running, paused, queueMonitoringSnapshot]);

  // Alarm cleanup
  useEffect(() => {
    if (!running || paused || phase !== "focus") alarmRef.current?.stop();
  }, [running, paused, phase]);
  useEffect(() => () => { alarmRef.current?.close(); alarmRef.current = null; }, []);

  const startSession = useCallback(() => {
    if (!user) return;
    void saveSessionTimerSettings(user.id, timerSettings);
    if (!alarmRef.current) alarmRef.current = createAlarmController();
    alarmRef.current.prime();
    samplesRef.current = []; eventsRef.current = [];
    pendingSnapshotsRef.current = [];
    snapshotThrottleRef.current = {};
    focusMsRef.current = 0; breakMsRef.current = 0; sessionMsRef.current = 0;
    setFocusCompleted(0);
    prevFlagsRef.current = {
      phoneDetected: false,
      eyesClosed10s: false,
      lookingAwayLong: false,
      headDownLong: false,
      alarmRunning: false,
      away: false,
    };
    sessionStartedAtRef.current = new Date().toISOString();
    eventsRef.current.push({ t: 0, type: "session_start" });
    phaseRef.current = "focus"; setPhase("focus");
    setRemainingSec(focusSec);
    setRunning(true);
    setPaused(false);
    setFlowState("studying");
    if (monitoringActive) {
      window.setTimeout(() => {
        void queueMonitoringSnapshot("session_start", 0);
      }, 1800);
    }
  }, [user, focusSec, timerSettings, monitoringActive, queueMonitoringSnapshot]);

  // Phase progress for timer ring
  const phaseTotalSec = useMemo(() => {
    if (phase === "focus") return focusSec;
    const isLong = focusCompleted > 0 && focusCompleted % longEvery === 0;
    return isLong ? longBreakSec : shortBreakSec;
  }, [phase, focusSec, shortBreakSec, longBreakSec, longEvery, focusCompleted]);

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
    roomId: presenceRoomId,
  });

  useLibraryRoomHeartbeat({
    userId: user?.id ?? null,
    status: libraryStatus,
    focusPhase: running ? phase : null,
    seatId: selectedSeatId,
    avatarUrl,
    roomId: presenceRoomId,
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
      // `layout` is intentionally omitted.  framer-motion's layout animation
      // applies CSS scale/translate transforms to the element which:
      //   (a) can leave a residual scaleY from the card→viewport ratio, and
      //   (b) the transforms interact with `position: fixed` incorrectly when
      //       the animation hasn't fully settled.
      // The border-radius still transitions smoothly via `animate` below.
      className={cn(
        "overflow-hidden bg-[#1a1206]",
        isImmersive
          ? "fixed inset-0 z-[200]"
          // Fill the viewport minus the sticky Topbar (h-16 = 64 px) and the
          // session main's padding (p-2 = 8 px × 2 on mobile; md:p-3 = 12 px × 2).
          // Using `h-[...]` instead of `min-h-[...]` so the card always fills
          // its slot regardless of flex-parent height resolution.
          : "relative h-[calc(100dvh-5rem)] md:h-[calc(100dvh-5.5rem)] w-full flex-1 rounded-2xl ring-1 ring-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.35)]",
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
          participantLimit={libraryRoomParticipantLimit}
        />
      </motion.div>

      {/* === Top bar: room info + dashboard exit === */}
      {!showAvatarCreator && !summary && flowState !== "library_select" && (
        <motion.div
          className="absolute inset-x-0 top-0"
          initial={reduce ? false : sessionTopBarEnter.initial}
          animate={sessionTopBarEnter.animate}
          transition={reduce ? { duration: 0.01 } : sessionTopBarEnter.transition}
        >
          <SessionTopBar
            studyingCount={studyingCount}
            roomName={libraryRoomName}
            roomId={libraryRoomId}
            joinCode={joinCode}
            isHost={libraryRoomRole === "host"}
            isPrivateRoom={isPrivateRoom}
            isImmersive={isImmersive}
            onToggleImmersive={toggleImmersive}
            onChangeLibrary={!isPrivateRoom ? handleChangeLibrary : undefined}
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
        {flowState === "library_select" && !isPrivateRoom && (
          <SessionLibraryLobby
            key="library_select"
            onSelectMain={() => setFlowState("seat_select")}
          />
        )}

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
                {isPrivateRoom ? libraryRoomName : "Virtual Library"}
              </motion.h1>
              <motion.p
                variants={sessionWelcomeItem}
                className="mt-1 text-sm text-slate-300"
              >
                {isPrivateRoom
                  ? "Your private study room — find a seat and focus together"
                  : "Find a seat and start your focus session"}
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
            className="absolute inset-0 z-[200] isolate flex items-center justify-center overflow-y-auto bg-black/55 px-4 py-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="game-lite-modal relative my-auto w-full max-w-xl overflow-visible px-5 pb-5 pt-8"
            >
              <div className="game-lite-ribbon">Set up Pomodoro</div>
              <button
                type="button"
                aria-label="Back to seat selection"
                onClick={() => {
                  setFlowState("seat_select");
                  setSelectedSeatId(null);
                }}
                className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-sky-200/60 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <p className="mt-1 text-center text-xs text-sky-200/60">
                {selectedSeat
                  ? `Seated at ${selectedSeat.label}`
                  : "Your avatar is seated and ready"}
              </p>

              <div className="mt-4">
                <SessionTimerConfig
                  timer={timerSettings}
                  onTimerChange={(patch) =>
                    setTimerSettings((prev) => ({ ...prev, ...patch }))
                  }
                />
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFlowState("seat_select");
                    setSelectedSeatId(null);
                  }}
                  className="game-lite-btn-ghost flex-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Seat
                </button>
                <button
                  type="button"
                  onClick={startSession}
                  className="game-lite-btn-gold flex-[1.55]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Play {timerSettings.focusMinutes}m
                </button>
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
            onSample={onSample}
            frameCaptureRef={monitoringActive ? frameCaptureRef : undefined}
            running={running}
            paused={paused}
            phase={phase}
            remainingSec={remainingSec}
            phaseTotalSec={phaseTotalSec}
            focusCompleted={focusCompleted}
            onPause={() => setPaused(true)}
            onResume={() => setPaused(false)}
            onEnd={() => void endSession()}
            endDisabled={endingSession}
            sample={lastSample}
            flags={liveFocusFlags}
            eyesClosedMs={eyesClosedMs}
            alarmRunning={alarmRunning}
            layout={panelLayout}
          />
        </motion.div>
      )}

      {/* Exit-confirmation dialog */}
      <AnimatePresence>
        {exitDialogOpen ? (
          <motion.div
            key="exit-guard-backdrop"
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={handleStayInSession}
            />

            {/* Dialog card */}
            <motion.div
              key="exit-guard-card"
              className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#1a1206]/95 shadow-2xl shadow-black/60 backdrop-blur-xl"
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Amber top-bar accent */}
              <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />

              <div className="p-6">
                {/* Icon + title */}
                <div className="mb-4 flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                    {pendingExitDest === "__logout__" ? (
                      <LogOut className="h-4 w-4 text-amber-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {pendingExitDest === "__logout__"
                        ? "Log out during session?"
                        : pendingExitDest === "__lobby__"
                          ? "Change library?"
                          : "Leave your study session?"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {pendingExitDest === "__logout__"
                        ? "You're still in an active focus session. Logging out now will lose unsaved progress unless you save first."
                        : pendingExitDest === "__lobby__"
                          ? "You're still in an active focus session. End or discard it before choosing another library."
                          : "You have an active focus session running. Leaving now without saving will discard your focus data."}
                    </p>
                  </div>
                </div>

                {/* Has data hint */}
                {samplesRef.current.length > 0 ? (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="text-xs text-amber-300">
                      {samplesRef.current.length} focus samples collected — save them!
                    </span>
                  </div>
                ) : null}

                {/* Action buttons */}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleStayInSession}
                    className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-900/40 transition hover:bg-sky-500"
                  >
                    Continue Studying
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveAndExit()}
                    className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
                  >
                    {pendingExitDest === "__logout__"
                      ? "Save & Log Out"
                      : pendingExitDest === "__lobby__"
                        ? "Save & Change Library"
                        : "Save & Exit"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExitWithoutSaving}
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
                  >
                    {pendingExitDest === "__lobby__"
                      ? "Discard & Change Library"
                      : pendingExitDest === "__logout__"
                      ? "Log Out Without Saving"
                      : "Leave Without Saving"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
