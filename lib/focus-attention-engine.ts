import {
  SYSTEM_DESK_WORK_BIAS,
  SYSTEM_DISTRACTION_THRESHOLD,
  SYSTEM_FOCUS_SENSITIVITY,
  SYSTEM_FOCUS_THRESHOLD,
} from "@/lib/focus/system-config";
import type { FocusSampleState } from "@/lib/types";
import type { SignalMode } from "@/lib/focus-detection";
import { detectSleepEyeState } from "@/lib/vision/sleep-eye-detection";
import {
  classifyStudyContext,
  isDeskWorkMode,
  type StudyContextMode,
} from "@/lib/vision/study-context";

export type AttentionFlags = {
  hasFace: boolean;
  phoneDetected: boolean;
  eyesClosed: boolean;
  lookingAway: boolean;
  headDown: boolean;
  drowsy: boolean;
  studyContext?: StudyContextMode;
  signalMode?: SignalMode;
};

export type AttentionDurations = {
  eyesClosedMs: number;
  lookingAwayMs: number;
  headDownMs: number;
  phoneDetectedMs: number;
  noFaceMs: number;
  engagedMs: number;
};

export type AttentionMeasurements = {
  nowMs: number;
  hasFace: boolean;
  /** raw EAR (~0.1–0.35 typical) */
  ear: number;
  earL?: number;
  earR?: number;
  /** Both eyes read shut (winks / one-eye occlusion do not set this). */
  eyeLikelyClosed?: boolean;
  /** ~0–1 eye openness from landmark blendshapes; gated until EAR shows sustained closure. */
  eyeBlinkAssist?: number | null;
  /** Per-eye blink blendshape scores (0 = open, higher = shut). */
  eyeBlinkShutL?: number;
  eyeBlinkShutR?: number;
  eyeReliabilityL?: number;
  eyeReliabilityR?: number;
  signalMode?: SignalMode;
  /** 0–100 */
  eyesScore: number;
  /** 0–100 */
  faceScore: number;
  /** 0–1 (higher = more turned away) */
  yaw: number;
  /** 0–1 (higher = more pitch dev / looking down/up) */
  pitch: number;
  phoneDetected: boolean;
  /**
   * 0–1 trust that framing + pretrained detector + sharpness support landmark scores.
   * Lower → softer penalties / less drift from noisy yaw/pitch (bad webcam).
   */
  trackingConfidence?: number;
};

export type AttentionFrameResult = {
  score: number;
  state: FocusSampleState;
  rawEar: number;
  hasFace: boolean;
  eyesScore: number;
  faceScore: number;
  yaw: number;
  pitch: number;
  flags: AttentionFlags;
  durations: AttentionDurations;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const clamp100 = (x: number) => Math.min(100, Math.max(0, x));

/** Blinks are shorter than this; Sleep UI / badge stay calm until closure lasts longer. */
export const SLEEP_UI_MIN_CLOSED_MS = 480;

type PerclosPoint = { t: number; closed: boolean };

type OnlineDrowsyModel = {
  // logistic regression: p = sigmoid(b + sum(w_i * x_i))
  w: number[];
  b: number;
  // feature normalization EMA to keep scale stable
  mean: number[];
  var: number[];
};

export class FocusAttentionEngine {
  private lastNowMs: number | null = null;
  private lastScore: number | null = null;
  private lastStableEyesScore: number | null = null;

  private eyesClosedMs = 0;
  /** Consecutive ms eyes read “closed” from EAR/landmarks only (no TF eye model). */
  private eyesClosedEarMs = 0;
  private lastIsClosedEar = false;
  /** Blendshape assist reports shut eyes — accumulates when EAR is ambiguous. */
  private blinkAssistClosedMs = 0;
  private lowEarConsecutiveMs = 0;
  private lookingAwayMs = 0;
  private headDownMs = 0;
  private phoneDetectedMs = 0;
  private noFaceMs = 0;
  private engagedMs = 0;

  private perclos: PerclosPoint[] = [];
  private perclosClosedMs = 0;

  // Blink tracking (better drowsiness signal than raw EAR alone)
  private blinkState: "open" | "closing" | "closed" = "open";
  private blinkClosedMs = 0;
  private lastBlinkAtMs: number | null = null;
  private blinkTimes: number[] = [];
  private longBlinkTimes: number[] = [];

  // Small online ML model for drowsiness probability (adapts per user/camera)
  private drowsyModel: OnlineDrowsyModel = {
    w: [0.6, 0.45, 0.35, 0.25, 0.25],
    b: -1.2,
    mean: [0, 0, 0, 0, 0],
    var: [1, 1, 1, 1, 1],
  };
  private drowsyTrainCooldownMs = 0;

  /** After opening eyes from ~sleep-scale closure, suppress drowsy cap/PERCLOS hangover so score can recover. */
  private postWakeGraceUntilMs: number | null = null;
  /** Streak while raw measurements look clearly awake — sheds false “drowsy” so score isn’t stuck at the 55 cap. */
  private alertRecoveryMs = 0;

  reset() {
    this.lastNowMs = null;
    this.lastScore = null;
    this.lastStableEyesScore = null;
    this.eyesClosedMs = 0;
    this.eyesClosedEarMs = 0;
    this.lastIsClosedEar = false;
    this.blinkAssistClosedMs = 0;
    this.lowEarConsecutiveMs = 0;
    this.lookingAwayMs = 0;
    this.headDownMs = 0;
    this.phoneDetectedMs = 0;
    this.noFaceMs = 0;
    this.engagedMs = 0;
    this.perclos = [];
    this.perclosClosedMs = 0;
    this.blinkState = "open";
    this.blinkClosedMs = 0;
    this.lastBlinkAtMs = null;
    this.blinkTimes = [];
    this.longBlinkTimes = [];
    this.drowsyModel = {
      w: [0.6, 0.45, 0.35, 0.25, 0.25],
      b: -1.2,
      mean: [0, 0, 0, 0, 0],
      var: [1, 1, 1, 1, 1],
    };
    this.drowsyTrainCooldownMs = 0;
    this.postWakeGraceUntilMs = null;
    this.alertRecoveryMs = 0;
  }

  update(m: AttentionMeasurements): AttentionFrameResult {
    const dt =
      this.lastNowMs == null ? 0 : Math.max(0, Math.min(2000, m.nowMs - this.lastNowMs));
    this.lastNowMs = m.nowMs;

    // --- Eye closure / drowsiness: align with Drowsiness_Detection.py (dlib 68 landmarks + EAR) ---
    // thresh = 0.25, frame_check = 20 consecutive low-EAR frames before alert.
    const sensitivity = SYSTEM_FOCUS_SENSITIVITY;
    const earThreshBase =
      sensitivity === "strict" ? 0.27 : sensitivity === "accessible" ? 0.22 : 0.25;
    const tc = clamp01(m.trackingConfidence ?? 1);
    const lowQuality = tc < 0.48;
    const EAR_THRESH_SCRIPT = lowQuality ? earThreshBase - 0.02 : earThreshBase;
    const EAR_OPEN_HYST = EAR_THRESH_SCRIPT + (lowQuality ? 0.04 : 0.03);
    const SCRIPT_FRAME_CHECK = 20;
    const DROWSY_CONSEC_MS = Math.round((1000 / 30) * SCRIPT_FRAME_CHECK);
    /** Fallback when landmarks are ambiguous (glasses/lighting) — still EAR-heavy */
    const EYE_CLOSED_SCORE_FALLBACK = 12;
    /** Blendshape assist: only AFTER this many ms of EAR-closed streak (blinks stay shorter). */
    const BLINK_ASSIST_AFTER_EAR_MS = 620;
    const BLINK_ASSIST_SLEEP_MS = 320;
    const BLINK_CLOSED = 0.35;
    const BLINK_OPEN = 0.55;
    const LOOKING_AWAY_YAW =
      sensitivity === "accessible" ? 0.62 : sensitivity === "strict" ? 0.48 : 0.55;
    const LOOKING_AWAY_FACE_SCORE =
      sensitivity === "accessible" ? 46 : sensitivity === "strict" ? 58 : 52;
    const HEAD_DOWN_PITCH =
      sensitivity === "accessible" ? 0.68 : sensitivity === "strict" ? 0.52 : 0.58;
    const HEAD_DOWN_FACE_SCORE =
      sensitivity === "accessible" ? 52 : sensitivity === "strict" ? 66 : 60;
    const headDownCapMs =
      sensitivity === "accessible" ? 9_000 : sensitivity === "strict" ? 3_200 : 4_500;

    const hasFace = m.hasFace;
    /** Brief sustained attentive frames suppress lingering drowsy / 55-score cap. */
    const ALERT_RECOVERY_DWELL_MS = 420;
    /** Accumulated engaged time needed before scores can climb into the ~90–100 band (raised each frame via `engagedNow`). */
    const ENGAGED_FOR_TOP_MS = 7_000;
    /** Shortcut: unmistakably alert again for a stretch + partial engaged credit → unlock top scores without waiting the full dwell. */
    const HIGH_SCORE_ALERT_FAST_MS = 1_650;
    const ENGAGED_PARTIAL_FOR_FAST_TOP_MS = 4_250;

    // Consecutive low-EAR streak (same as Python: increment while ear < thresh, else reset to 0)
    if (hasFace && dt > 0) {
      this.lowEarConsecutiveMs =
        m.ear > 0 && m.ear < EAR_THRESH_SCRIPT
          ? this.lowEarConsecutiveMs + dt
          : 0;
    } else if (!hasFace) {
      this.lowEarConsecutiveMs = 0;
    }

    const eyeRelL = m.eyeReliabilityL ?? 1;
    const eyeRelR = m.eyeReliabilityR ?? 1;
    const relMin = lowQuality ? 0.16 : 0.22;
    const earL = m.earL ?? m.ear;
    const earR = m.earR ?? m.ear;
    const sleepEyes = detectSleepEyeState(earL, earR, eyeRelL, eyeRelR);
    /** Sleep path: EAR-only, both eyes, strict closed threshold — no blendshapes. */
    const sleepBothClosed = hasFace && sleepEyes.bothClosed;
    const sleepAnyOpen = hasFace && sleepEyes.anyOpen;

    const isClosedEar = hasFace
      ? this.lastIsClosedEar
        ? !sleepAnyOpen
        : sleepBothClosed
      : false;
    if (hasFace && dt > 0) {
      this.eyesClosedEarMs = isClosedEar ? this.eyesClosedEarMs + dt : 0;
    } else if (!hasFace) {
      this.eyesClosedEarMs = 0;
    }
    this.lastIsClosedEar = isClosedEar;

    // Sleep countdown — EAR-only both-eyes detector; release as soon as any eye reads open.
    const sleepClosed = Boolean(
      hasFace &&
        (this.eyesClosedMs > 0 ? !sleepAnyOpen : isClosedEar),
    );

    // Low tracking confidence → landmark yaw/pitch are less trustworthy (blur / small face).
    const poseScale = 0.22 + 0.78 * tc;
    const yawForPose = m.yaw * poseScale;
    const pitchForPose = m.pitch * poseScale;

    // Looking away / head down (require face present)
    const lookingAway = hasFace
      ? yawForPose >= LOOKING_AWAY_YAW || m.faceScore <= LOOKING_AWAY_FACE_SCORE
      : false;
    const headDown = hasFace
      ? pitchForPose >= HEAD_DOWN_PITCH ||
          (m.faceScore <= HEAD_DOWN_FACE_SCORE && pitchForPose >= 0.45)
      : false;

    const phoneDetected = hasFace ? m.phoneDetected : false;

    // accumulate durations
    const eyesClosedStreakBefore = this.eyesClosedMs;
    this.eyesClosedMs = sleepClosed ? this.eyesClosedMs + dt : 0;

    if (sleepClosed) {
      this.postWakeGraceUntilMs = null;
    } else if (eyesClosedStreakBefore >= 9_000) {
      // Opened eyes after near-sleep closure — PERCLOS window still “remembers” ~10s shut → false drowsy + cap 55.
      this.postWakeGraceUntilMs = m.nowMs + 22_000;
      this.perclos = [];
      this.perclosClosedMs = 0;
    }

    if (
      this.postWakeGraceUntilMs != null &&
      m.nowMs >= this.postWakeGraceUntilMs
    ) {
      this.postWakeGraceUntilMs = null;
    }
    const inPostWakeGrace =
      this.postWakeGraceUntilMs != null && m.nowMs < this.postWakeGraceUntilMs;
    const eyesClosedUi =
      sleepClosed && this.eyesClosedMs >= SLEEP_UI_MIN_CLOSED_MS;

    /** Current frame reads clearly attentive — trims false drowsy + 55-score cap linger. */
    const clearAlertEvidence =
      hasFace &&
      tc >= 0.32 &&
      !eyesClosedUi &&
      (sleepEyes.bothOpen || sleepEyes.anyOpen || m.ear >= EAR_OPEN_HYST) &&
      m.eyesScore >= 52 &&
      m.faceScore >= 50 &&
      yawForPose <= 0.65 &&
      pitchForPose <= 0.65;
    if (hasFace && dt > 0) {
      this.alertRecoveryMs = clearAlertEvidence
        ? this.alertRecoveryMs + dt
        : Math.max(0, this.alertRecoveryMs - dt * 2.75);
    } else if (!hasFace) {
      this.alertRecoveryMs = 0;
    }

    this.lookingAwayMs = lookingAway ? this.lookingAwayMs + dt : 0;
    this.headDownMs = headDown ? this.headDownMs + dt : 0;
    this.phoneDetectedMs = phoneDetected ? this.phoneDetectedMs + dt : 0;
    this.noFaceMs = hasFace ? 0 : this.noFaceMs + dt;

    const signalMode = m.signalMode ?? "full";
    const uncertainTracking = hasFace && tc < 0.28 && signalMode === "uncertain";

    // --- Blink detection + time-weighted PERCLOS (60s) ---
    const now = m.nowMs;
    const windowMs = 60_000;
    const cutoff = now - windowMs;
    const nearClosed = Boolean(hasFace && sleepBothClosed);

    if (dt > 0 && hasFace) {
      // Time-weighted PERCLOS
      this.perclos.push({ t: now, closed: nearClosed });
      if (nearClosed) this.perclosClosedMs += dt;
      while (this.perclos.length > 1 && this.perclos[0].t < cutoff) {
        // We can't perfectly subtract dt for historical points without storing durations,
        // so we keep a conservative decay when trimming.
        this.perclos.shift();
      }
      // Soft decay of the closed-ms accumulator so it tracks the window roughly.
      // (Prevents “stuck high” after window moves.) Faster decay when visibly alert again.
      const perclosIdleDecay = clearAlertEvidence ? 0.2 : 0.08;
      this.perclosClosedMs = Math.max(
        0,
        Math.min(windowMs, this.perclosClosedMs - dt * perclosIdleDecay),
      );

      // Blink FSM: count a blink when we go closed -> open and the closure was short.
      if (this.blinkState === "open") {
        if (m.ear > 0 && m.ear < EAR_THRESH_SCRIPT) {
          this.blinkState = "closed";
          this.blinkClosedMs = 0;
        }
      } else if (this.blinkState === "closed") {
        this.blinkClosedMs += dt;
        if (m.ear >= EAR_OPEN_HYST) {
          const closedFor = this.blinkClosedMs;
          // Typical blink: 80–450ms. Long blink: 700–2000ms (drowsy cue).
          if (closedFor >= 80 && closedFor <= 450) {
            this.blinkTimes.push(now);
            this.lastBlinkAtMs = now;
          } else if (closedFor >= 700 && closedFor <= 2000) {
            this.longBlinkTimes.push(now);
            this.lastBlinkAtMs = now;
          }
          this.blinkState = "open";
          this.blinkClosedMs = 0;
        }
      }

      // keep only last 60s
      while (this.blinkTimes.length && this.blinkTimes[0] < cutoff) this.blinkTimes.shift();
      while (this.longBlinkTimes.length && this.longBlinkTimes[0] < cutoff)
        this.longBlinkTimes.shift();
    } else if (!hasFace) {
      // if no face, don't call it drowsy; treat as away
      this.perclos = [];
      this.perclosClosedMs = 0;
      this.blinkState = "open";
      this.blinkClosedMs = 0;
      this.lastBlinkAtMs = null;
      this.blinkTimes = [];
      this.longBlinkTimes = [];
    }

    const perclosRatio = clamp01(this.perclosClosedMs / windowMs);
    const blinkRatePerMin = this.blinkTimes.length; // already windowed to 60s
    const longBlinkRatePerMin = this.longBlinkTimes.length;
    const noBlinkForMs = this.lastBlinkAtMs == null ? 0 : now - this.lastBlinkAtMs;

    const eyesOpen =
      hasFace && !sleepClosed && (sleepEyes.bothOpen || sleepEyes.anyOpen || m.ear >= EAR_OPEN_HYST);

    const studyContext = classifyStudyContext({
      hasFace,
      pitch: pitchForPose,
      yaw: yawForPose,
      eyesOpen,
      eyesScore: m.eyesScore,
      faceScore: m.faceScore,
      phoneDetected,
      drowsy: false,
      noFaceMs: this.noFaceMs,
      headDownMs: this.headDownMs,
      lookingAwayMs: this.lookingAwayMs,
      blinkRatePerMin,
      trackingConfidence: tc,
      deskWorkBias: SYSTEM_DESK_WORK_BIAS,
    });

    const deskWork = isDeskWorkMode(studyContext);
    const effectiveHeadDown = headDown && !deskWork;
    const effectiveLookingAway =
      lookingAway && !(studyContext === "gaze_shift" && this.lookingAwayMs < 4_500);

    const drowsyHeuristic = Boolean(
      hasFace &&
        sleepEyes.confidence >= 0.2 &&
        (perclosRatio >= 0.28 ||
          longBlinkRatePerMin >= 3 ||
          (sleepBothClosed && this.eyesClosedMs >= 3_000) ||
          (perclosRatio >= 0.2 && noBlinkForMs >= 14_000)),
    );

    // --- Online ML drowsiness probability ---
    // Features (all bounded / normalized):
    // x0: perclosRatio (0..1)
    // x1: longBlinkRatePerMin / 6 (0..~1)
    // x2: clamp(noBlinkForMs/20000,0..1)
    // x3: clamp(headDownMs/6000,0..1)
    // x4: clamp(lookingAwayMs/8000,0..1)
    const xRaw = [
      perclosRatio,
      clamp01(longBlinkRatePerMin / 6),
      clamp01(noBlinkForMs / 20_000),
      clamp01(this.headDownMs / 6_000),
      clamp01(this.lookingAwayMs / 8_000),
    ];

    const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
    const norm = (x: number, i: number) => {
      const mu = this.drowsyModel.mean[i] ?? 0;
      const v = this.drowsyModel.var[i] ?? 1;
      const sd = Math.sqrt(Math.max(1e-6, v));
      return (x - mu) / sd;
    };

    // Update running normalization (slow EMA)
    if (hasFace && dt > 0) {
      const beta = 0.02;
      for (let i = 0; i < xRaw.length; i++) {
        const mu = this.drowsyModel.mean[i];
        const dx = xRaw[i] - mu;
        const nextMu = mu + beta * dx;
        // Welford-ish EMA variance update
        const nextVar =
          this.drowsyModel.var[i] * (1 - beta) + beta * dx * (xRaw[i] - nextMu);
        this.drowsyModel.mean[i] = nextMu;
        this.drowsyModel.var[i] = Math.max(1e-4, nextVar);
      }
    }

    const x = xRaw.map((v, i) => norm(v, i));
    let z = this.drowsyModel.b;
    for (let i = 0; i < x.length; i++) z += (this.drowsyModel.w[i] ?? 0) * x[i];
    const drowsyProb = hasFace ? sigmoid(z) : 0;

    // Train online using conservative pseudo-labels (avoid feedback loops):
    // - Positive label only when sustained near-closed/drowsy signals
    // - Negative label only when clearly engaged and alert
    // Rate limited to avoid oscillation.
    if (this.drowsyTrainCooldownMs > 0) {
      this.drowsyTrainCooldownMs = Math.max(0, this.drowsyTrainCooldownMs - dt);
    }
    const canTrain = hasFace && dt > 0 && this.drowsyTrainCooldownMs === 0;
    const pseudoY =
      // strong positive: sustained near-closed or repeated long blinks
      perclosRatio >= 0.28 || longBlinkRatePerMin >= 3
        ? 1
        : // strong negative: clearly engaged + no near-closed
          perclosRatio <= 0.08 &&
            !drowsyHeuristic &&
            !lookingAway &&
            !headDown &&
            !eyesClosedUi &&
            m.faceScore >= 70 &&
            m.eyesScore >= 70
          ? 0
          : null;

    if (canTrain && pseudoY != null) {
      const lr = 0.12;
      const p = drowsyProb;
      const grad = p - pseudoY;
      for (let i = 0; i < this.drowsyModel.w.length; i++) {
        this.drowsyModel.w[i] -= lr * grad * x[i];
      }
      this.drowsyModel.b -= lr * grad;
      this.drowsyTrainCooldownMs = 2500;
    }

    // Final drowsy decision: ML probability OR heuristic (keeps behavior safe)
    const drowsyRaw = Boolean(
      hasFace && !uncertainTracking && (drowsyProb >= 0.62 || drowsyHeuristic),
    );
    /** Brief sustained “awake again” wipes drowsy so the score isn’t welded to ~55 cap. */
    const drowsy = Boolean(
      drowsyRaw && !inPostWakeGrace && this.alertRecoveryMs < ALERT_RECOVERY_DWELL_MS,
    );

    const studyContextFinal = drowsy ? "drowsy" : studyContext;

    // --- Stable eyes score (ignore normal blinks) ---
    // If eyes are "closed" only briefly (blink), do not penalize the Eyes bar/score.
    const rawEyesScore = clamp100(m.eyesScore);
    const stableEyesScore = (() => {
      if (!hasFace) return 0;
      if (this.lastStableEyesScore == null) return rawEyesScore;
      // Ignore brief closures up to ~780ms so normal/long blinks don’t drag the eyes score down.
      if (sleepClosed && this.eyesClosedMs > 0 && this.eyesClosedMs <= 780) {
        return this.lastStableEyesScore;
      }
      // Otherwise smooth a bit to avoid jitter. Rise faster than fall so recovering into the 90s isn’t sluggish.
      const alpha = rawEyesScore < this.lastStableEyesScore ? 0.45 : 0.28;
      return this.lastStableEyesScore * (1 - alpha) + rawEyesScore * alpha;
    })();
    this.lastStableEyesScore = stableEyesScore;

    // engaged time gate — desk_work allows head-down note-taking
    const engagedNow =
      hasFace &&
      !uncertainTracking &&
      tc >= 0.38 &&
      !phoneDetected &&
      !effectiveLookingAway &&
      !effectiveHeadDown &&
      !eyesClosedUi &&
      !drowsy &&
      stableEyesScore >= (deskWork ? 48 : 55) &&
      m.faceScore >= (deskWork ? 48 : 55) &&
      (deskWork || (m.yaw <= 0.58 && m.pitch <= 0.6));

    if (engagedNow) {
      const rateBoost =
        this.alertRecoveryMs >= 650 ? 1.7 : clearAlertEvidence ? 1.25 : 1;
      this.engagedMs = Math.min(
        60_000,
        this.engagedMs + dt * rateBoost,
      );
    } else {
      // Decay slower when still “somewhat on” so returning to peak doesn’t feel like resetting from zero every dip.
      this.engagedMs = Math.max(
        0,
        this.engagedMs - dt * (clearAlertEvidence ? 1.15 : 1.55),
      );
    }

    // --- base score (tiered by signal mode) ---
    const weights =
      signalMode === "full"
        ? { eyes: 0.5, pose: 0.3, presence: 0.2 }
        : signalMode === "monocular"
          ? { eyes: 0.42, pose: 0.33, presence: 0.25 }
          : signalMode === "eyewear"
            ? { eyes: 0.15, pose: 0.45, presence: 0.4 }
            : signalMode === "pose_only"
              ? { eyes: 0.08, pose: 0.35, presence: 0.57 }
              : { eyes: 0.2, pose: 0.3, presence: 0.5 };

    const poseComponent = Math.max(0, 100 - yawForPose * 52 - pitchForPose * 28);
    const presenceComponent = tc * 100;
    let base =
      stableEyesScore * weights.eyes +
      poseComponent * weights.pose +
      presenceComponent * weights.presence -
      (drowsy ? 22 : 0);

    if (deskWork && !drowsy && !phoneDetected) {
      base = Math.max(base, 65);
    }
    if (uncertainTracking) {
      base = base * 0.55 + 62 * 0.45;
    }
    base = clamp100(base);

    // --- gating rules (hard realism constraints) ---
    let cap = 100;
    let state: FocusSampleState = "drifting";

    // Away: no face for a while
    if (!hasFace && this.noFaceMs >= 5_000) {
      cap = 0;
      state = "away";
    }

    // Phone: immediate not focused
    if (phoneDetected) {
      cap = Math.min(cap, 25);
      state = "distracted";
    }

    // Long eyes-closed: sleeping/unfocused
    if (this.eyesClosedMs >= 10_000) {
      cap = Math.min(cap, 10);
      state = "sleeping";
    }

    // Sustained look-away/head-down
    if (this.lookingAwayMs >= 6_000) {
      cap = Math.min(cap, 40);
      if (state !== "sleeping") state = "distracted";
    } else if (this.lookingAwayMs >= 1_800 && state === "drifting") {
      state = "drifting";
    }

    if (!deskWork && this.headDownMs >= headDownCapMs) {
      cap = Math.min(cap, 50);
      if (state !== "sleeping") state = "distracted";
    }

    if (uncertainTracking && state !== "sleeping" && state !== "away") {
      cap = Math.min(cap, 72);
      state = "drifting";
    }

    if (drowsy && state !== "sleeping") {
      cap = Math.min(cap, 55);
      state = this.eyesClosedMs > 1200 ? "distracted" : "drifting";
    }

    // High-score gate: allow ~90–100 only after proving sustained engagement (or shorter fast-track when clearly alert).
    const highGateOk =
      this.engagedMs >= ENGAGED_FOR_TOP_MS ||
      (this.alertRecoveryMs >= HIGH_SCORE_ALERT_FAST_MS &&
        this.engagedMs >= ENGAGED_PARTIAL_FOR_FAST_TOP_MS);

    /** Without full gate yet, soften ceiling so high-80s can already lean toward ~90 visually. */
    const softPeakCap = highGateOk ? 100 : 94;
    if (!highGateOk) cap = Math.min(cap, softPeakCap);

    // Compute target (post-cap)
    const target = Math.min(base, cap);

    // --- dynamics: fast drops; recover faster after a trough so “back on task” moves score up visibly ---
    const prev = this.lastScore ?? target;
    const goingUp = target > prev;
    const bouncingFromTrough =
      prev < 52 &&
      target > prev + 14 &&
      this.alertRecoveryMs >= ALERT_RECOVERY_DWELL_MS;
    const alphaUpBase = bouncingFromTrough ? 0.22 : prev < 50 && target > prev ? 0.14 : 0.09;
    const alphaUp =
      goingUp && highGateOk && target >= 92 ? alphaUpBase * 1.2 : alphaUpBase;
    const alphaDown = 0.35; // quick penalty
    const alpha = goingUp ? alphaUp : alphaDown;
    const smoothed = prev * (1 - alpha) + target * alpha;
    this.lastScore = smoothed;

    // final state mapping (unless already forced above)
    if (state !== "away" && state !== "sleeping" && state !== "distracted") {
      if (smoothed >= SYSTEM_FOCUS_THRESHOLD && engagedNow) state = "focused";
      else if (smoothed < SYSTEM_DISTRACTION_THRESHOLD) state = "distracted";
      else state = "drifting";
    }

    const outScore = Math.round(clamp100(smoothed));

    return {
      score: outScore,
      state,
      rawEar: m.ear,
      hasFace,
      eyesScore: Math.round(clamp100(stableEyesScore)),
      faceScore: m.faceScore,
      yaw: clamp01(m.yaw),
      pitch: clamp01(m.pitch),
      flags: {
        hasFace,
        phoneDetected,
        eyesClosed: eyesClosedUi,
        lookingAway: effectiveLookingAway,
        headDown: effectiveHeadDown,
        drowsy,
        studyContext: studyContextFinal,
        signalMode,
      },
      durations: {
        eyesClosedMs: this.eyesClosedMs,
        lookingAwayMs: this.lookingAwayMs,
        headDownMs: this.headDownMs,
        phoneDetectedMs: this.phoneDetectedMs,
        noFaceMs: this.noFaceMs,
        engagedMs: this.engagedMs,
      },
    };
  }
}
