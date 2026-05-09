import type { FocusSampleState } from "@/lib/types";

export type AttentionFlags = {
  hasFace: boolean;
  phoneDetected: boolean;
  eyesClosed: boolean;
  lookingAway: boolean;
  headDown: boolean;
  drowsy: boolean;
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
  /** ~0–1 eye openness from TFJS eye model; gated until EAR shows sustained closure so blinks are neutral. */
  eyeOpennessMl?: number | null;
  /** 0–100 */
  eyesScore: number;
  /** 0–100 */
  faceScore: number;
  /** 0–1 (higher = more turned away) */
  yaw: number;
  /** 0–1 (higher = more pitch dev / looking down/up) */
  pitch: number;
  phoneDetected: boolean;
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
  /** TF model reports shut eyes — accumulates so sleep UX works when EAR is ambiguous. */
  private mlAssistClosedMs = 0;
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

  reset() {
    this.lastNowMs = null;
    this.lastScore = null;
    this.lastStableEyesScore = null;
    this.eyesClosedMs = 0;
    this.eyesClosedEarMs = 0;
    this.lastIsClosedEar = false;
    this.mlAssistClosedMs = 0;
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
  }

  update(m: AttentionMeasurements): AttentionFrameResult {
    const dt =
      this.lastNowMs == null ? 0 : Math.max(0, Math.min(2000, m.nowMs - this.lastNowMs));
    this.lastNowMs = m.nowMs;

    // --- Eye closure / drowsiness: align with Drowsiness_Detection.py (dlib 68 landmarks + EAR) ---
    // thresh = 0.25, frame_check = 20 consecutive low-EAR frames before alert.
    const EAR_THRESH_SCRIPT = 0.25;
    const EAR_OPEN_HYST = 0.28; // open only when clearly above thresh (debounce, avoids flicker)
    const SCRIPT_FRAME_CHECK = 20;
    const DROWSY_CONSEC_MS = Math.round((1000 / 30) * SCRIPT_FRAME_CHECK);
    /** Fallback when landmarks are ambiguous (glasses/lighting) — still EAR-heavy */
    const EYE_CLOSED_SCORE_FALLBACK = 12;
    /** Pretrained eye openness: only AFTER this many ms of EAR-closed streak (blinks stay shorter). */
    const ML_APPLY_AFTER_EAR_CLOSED_MS = 620;
    /** TF says shut for this long → treat as closed for sleep countdown even if EAR is stuck high. */
    const ML_SLEEP_ASSIST_MS = 320;
    const ML_CLOSED = 0.22;
    const ML_OPEN = 0.35;
    const LOOKING_AWAY_YAW = 0.55;
    const LOOKING_AWAY_FACE_SCORE = 52;
    const HEAD_DOWN_PITCH = 0.58;
    const HEAD_DOWN_FACE_SCORE = 60;

    const hasFace = m.hasFace;

    // Consecutive low-EAR streak (same as Python: increment while ear < thresh, else reset to 0)
    if (hasFace && dt > 0) {
      this.lowEarConsecutiveMs =
        m.ear > 0 && m.ear < EAR_THRESH_SCRIPT
          ? this.lowEarConsecutiveMs + dt
          : 0;
    } else if (!hasFace) {
      this.lowEarConsecutiveMs = 0;
    }

    // Eyes closed: script rule is ear < 0.25; hysteresis so we don't flip open on one noisy frame
    const earClosedScript = hasFace && m.ear > 0 && m.ear < EAR_THRESH_SCRIPT;
    const earOpenScript = hasFace && m.ear >= EAR_OPEN_HYST;
    const closedFallback =
      hasFace &&
      m.eyesScore <= EYE_CLOSED_SCORE_FALLBACK &&
      m.ear > 0 &&
      m.ear < 0.32;

    const isClosedEar = hasFace
      ? this.lastIsClosedEar
        ? !(earOpenScript && !closedFallback)
        : earClosedScript || closedFallback
      : false;
    if (hasFace && dt > 0) {
      this.eyesClosedEarMs = isClosedEar ? this.eyesClosedEarMs + dt : 0;
    } else if (!hasFace) {
      this.eyesClosedEarMs = 0;
    }
    this.lastIsClosedEar = isClosedEar;

    const mlPenaltyOk =
      hasFace && this.eyesClosedEarMs > ML_APPLY_AFTER_EAR_CLOSED_MS;
    const mlClosedRaw =
      hasFace && m.eyeOpennessMl != null && m.eyeOpennessMl <= ML_CLOSED;

    if (hasFace && dt > 0) {
      if (m.eyeOpennessMl != null && m.eyeOpennessMl <= ML_CLOSED) {
        this.mlAssistClosedMs += dt;
      } else if (m.eyeOpennessMl != null && m.eyeOpennessMl >= ML_OPEN) {
        this.mlAssistClosedMs = 0;
      } else if (m.eyeOpennessMl != null) {
        this.mlAssistClosedMs = Math.max(0, this.mlAssistClosedMs - dt * 1.5);
      }
    } else if (!hasFace) {
      this.mlAssistClosedMs = 0;
    }

    const mlSleepAssist =
      hasFace &&
      m.eyeOpennessMl != null &&
      m.eyeOpennessMl <= ML_CLOSED &&
      this.mlAssistClosedMs >= ML_SLEEP_ASSIST_MS;

    // Sleep countdown + eyesClosed flag: EAR/landmarks OR sustained TF “shut” (fixes stuck EAR when lids are down).
    // While already counting, release only when ear or TF clearly open (same spirit as previous hysteresis).
    const sleepClosed = hasFace
      ? this.eyesClosedMs > 0
        ? closedFallback ||
          !(earOpenScript || (m.eyeOpennessMl != null && m.eyeOpennessMl >= ML_OPEN))
        : isClosedEar || mlSleepAssist
      : false;

    // Looking away / head down (require face present)
    const lookingAway = hasFace
      ? m.yaw >= LOOKING_AWAY_YAW || m.faceScore <= LOOKING_AWAY_FACE_SCORE
      : false;
    const headDown = hasFace
      ? m.pitch >= HEAD_DOWN_PITCH || (m.faceScore <= HEAD_DOWN_FACE_SCORE && m.pitch >= 0.45)
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
    this.lookingAwayMs = lookingAway ? this.lookingAwayMs + dt : 0;
    this.headDownMs = headDown ? this.headDownMs + dt : 0;
    this.phoneDetectedMs = phoneDetected ? this.phoneDetectedMs + dt : 0;
    this.noFaceMs = hasFace ? 0 : this.noFaceMs + dt;

    // --- Blink detection + time-weighted PERCLOS (60s) ---
    const now = m.nowMs;
    const windowMs = 60_000;
    const cutoff = now - windowMs;
    const nearClosed = hasFace
      ? sleepClosed ||
          (m.ear > 0 && m.ear < EAR_THRESH_SCRIPT) ||
          (mlPenaltyOk && mlClosedRaw)
      : false;

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
      // (Prevents “stuck high” after window moves.)
      this.perclosClosedMs = Math.max(0, Math.min(windowMs, this.perclosClosedMs - dt * 0.08));

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

    // Baseline heuristic (used as pseudo-labels for online ML)
    const mlVeryShut =
      hasFace &&
      mlPenaltyOk &&
      m.eyeOpennessMl != null &&
      m.eyeOpennessMl <= 0.18;
    const drowsyHeuristic =
      hasFace &&
      (perclosRatio >= 0.22 ||
        longBlinkRatePerMin >= 2 ||
        this.lowEarConsecutiveMs >= DROWSY_CONSEC_MS ||
        (perclosRatio >= 0.16 && noBlinkForMs >= 12_000) ||
        (perclosRatio >= 0.14 && blinkRatePerMin <= 4) ||
        (mlVeryShut &&
          m.ear > 0 &&
          m.ear < 0.3 &&
          (m.eyesScore < 62 || mlClosedRaw)));

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
    const drowsyRaw = hasFace && (drowsyProb >= 0.62 || drowsyHeuristic);
    const drowsy = drowsyRaw && !inPostWakeGrace;

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
      // Otherwise smooth a bit to avoid jitter.
      const alpha = rawEyesScore < this.lastStableEyesScore ? 0.45 : 0.18;
      return this.lastStableEyesScore * (1 - alpha) + rawEyesScore * alpha;
    })();
    this.lastStableEyesScore = stableEyesScore;

    // engaged time gate (only when everything is consistently "good")
    const engagedNow =
      hasFace &&
      !phoneDetected &&
      !lookingAway &&
      !headDown &&
      !eyesClosedUi &&
      !drowsy &&
      stableEyesScore >= 64 &&
      m.faceScore >= 64 &&
      m.yaw <= 0.52 &&
      m.pitch <= 0.54;

    if (engagedNow) {
      this.engagedMs = Math.min(60_000, this.engagedMs + dt);
    } else {
      // decay faster than growth so you must re-earn 90–100
      this.engagedMs = Math.max(0, this.engagedMs - dt * 1.75);
    }

    // --- base score ---
    // eyes dominates, but head pose + face stability matters for realism.
    const stabilityPenalty = clamp100((Math.max(0, m.yaw - 0.25) / 0.75) * 35) +
      clamp100((Math.max(0, m.pitch - 0.25) / 0.75) * 25);
    let base =
      stableEyesScore * 0.64 +
      m.faceScore * 0.34 -
      stabilityPenalty * 0.25 -
      (drowsy ? 22 : 0);
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

    if (this.headDownMs >= 4_500) {
      cap = Math.min(cap, 50);
      if (state !== "sleeping") state = "distracted";
    }

    if (drowsy && state !== "sleeping") {
      cap = Math.min(cap, 55);
      state = this.eyesClosedMs > 1200 ? "distracted" : "drifting";
    }

    // High-score gate: only after sustained engaged window
    const highGateOk = this.engagedMs >= 25_000;
    if (!highGateOk) cap = Math.min(cap, 88);

    // Compute target (post-cap)
    const target = Math.min(base, cap);

    // --- dynamics: fast drops, slow gains ---
    const prev = this.lastScore ?? target;
    const goingUp = target > prev;
    const alphaUp = 0.06; // slow recovery
    const alphaDown = 0.35; // quick penalty
    const alpha = goingUp ? alphaUp : alphaDown;
    const smoothed = prev * (1 - alpha) + target * alpha;
    this.lastScore = smoothed;

    // final state mapping (unless already forced above)
    if (state !== "away" && state !== "sleeping" && state !== "distracted") {
      if (smoothed >= 74 && engagedNow) state = "focused";
      else if (smoothed < 45) state = "distracted";
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
        lookingAway,
        headDown,
        drowsy,
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
