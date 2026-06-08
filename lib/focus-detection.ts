import type { FocusSampleState } from "./types";
import type { NormalizedLandmark } from "@/lib/vision/face-landmarker";
import { MP_LEFT_EYE_EAR, MP_RIGHT_EYE_EAR } from "@/lib/vision/landmark-indices";
import type { FacePresenceSignals } from "@/lib/face-presence-quality";

export type SignalMode = "full" | "monocular" | "eyewear" | "pose_only" | "uncertain";

export type FocusFrameResult = {
  score: number;
  state: FocusSampleState;
  rawEar: number;
  hasFace: boolean;
  /** 0–100 from eye openness (EAR), primary “eyes on task” signal */
  eyesScore: number;
  /** 0–100 from facing the camera (yaw + pitch + expressions) */
  faceScore: number;
  /** 0–1 rough head yaw deviation (higher = more turned away) */
  yaw: number;
  /** 0–1 rough head pitch deviation (higher = more up/down away) */
  pitch: number;
  /** Pretrained detector + ROI sharpness — how much to trust this frame (optional). */
  trackingConfidence?: number;
  /** Composite framing + detector + sharpness (optional). */
  presenceQuality?: number;
  signalMode?: SignalMode;
  earL?: number;
  earR?: number;
  eyeReliabilityL?: number;
  eyeReliabilityR?: number;
  eyeBlinkAssist?: number;
};

export type Landmark68 = {
  getPosition?: (index: number) => { x: number; y: number };
  positions?: ReadonlyArray<{ x: number; y: number }>;
};

export type FaceSignalsInput = {
  landmarks: NormalizedLandmark[];
  blendshapes: Record<string, number>;
  transformMatrix: number[] | null;
  presence: FacePresenceSignals;
  videoWidth: number;
  videoHeight: number;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function landmarkPoint(
  lm: Landmark68 | undefined,
  index: number,
): { x: number; y: number } | null {
  if (!lm) return null;
  if (typeof lm.getPosition === "function") {
    try {
      return lm.getPosition(index);
    } catch {
      /* fall through */
    }
  }
  const p = lm.positions?.[index];
  return p ?? null;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function earFromIndices(
  landmarks: NormalizedLandmark[],
  indices: readonly number[],
  videoWidth: number,
  videoHeight: number,
): number {
  const pts = indices
    .map((i) => landmarks[i])
    .filter((p): p is NormalizedLandmark => !!p)
    .map((p) => ({ x: p.x * videoWidth, y: p.y * videoHeight }));
  if (pts.length < 6) return 0;
  const v1 = dist(pts[1], pts[5]);
  const v2 = dist(pts[2], pts[4]);
  const h = dist(pts[0], pts[3]);
  if (h < 1e-6) return 0;
  return (v1 + v2) / (2 * h);
}

function earFrom68(landmarks: Landmark68, indices: number[]): number {
  const p = indices
    .map((i) => landmarkPoint(landmarks, i))
    .filter((x): x is { x: number; y: number } => x != null);
  if (p.length < 6) return 0;
  const v1 = dist(p[1], p[5]);
  const v2 = dist(p[2], p[4]);
  const h = dist(p[0], p[3]);
  if (h < 1e-6) return 0;
  return (v1 + v2) / (2 * h);
}

/** Head pose from 4x4 facial transformation matrix (row-major). */
export function poseFromTransformMatrix(data: number[] | null): {
  yaw: number;
  pitch: number;
  roll: number;
} {
  if (!data || data.length < 16) return { yaw: 0, pitch: 0, roll: 0 };
  const r00 = data[0];
  const r10 = data[4];
  const r20 = data[8];
  const r21 = data[9];
  const r22 = data[10];
  const pitchRad = Math.asin(clamp01(Math.abs(-r20)));
  const yawRad = Math.atan2(r10, r00);
  const rollRad = Math.atan2(r21, r22);
  const yaw = clamp01(Math.abs(yawRad) / 0.85);
  const pitch = clamp01(Math.abs(pitchRad) / 0.75);
  const roll = clamp01(Math.abs(rollRad) / 0.65);
  return { yaw, pitch, roll };
}

function fuseEar(
  earL: number,
  earR: number,
  visL: number,
  visR: number,
  trackingConfidence = 1,
): { ear: number; mode: SignalMode } {
  const monoMin = trackingConfidence < 0.45 ? 0.18 : 0.25;
  const fullMin = trackingConfidence < 0.45 ? 0.32 : 0.4;
  if (visL >= fullMin && visR >= fullMin) {
    const wL = visL / (visL + visR);
    return { ear: earL * wL + earR * (1 - wL), mode: "full" };
  }
  if (visL >= visR && visL >= monoMin) return { ear: earL, mode: "monocular" };
  if (visR >= monoMin) return { ear: earR, mode: "monocular" };
  const best = visL >= visR ? earL : earR;
  if (Math.max(visL, visR) >= 0.12 && best > 0) {
    return { ear: best, mode: "monocular" };
  }
  return { ear: Math.max(earL, earR), mode: "pose_only" };
}

function earToScore(ear: number): number {
  if (ear <= 0) return 0;
  // Webcam EAR often sits 0.18–0.28 when open — map that band into a high focus score.
  return Math.min(100, Math.max(0, ((ear - 0.12) / (0.28 - 0.12)) * 100));
}

function blendshapeEyeOpenness(blendshapes: Record<string, number>): {
  openness: number;
  blinkL: number;
  blinkR: number;
} {
  const blinkL = blendshapes.eyeBlinkLeft ?? 0;
  const blinkR = blendshapes.eyeBlinkRight ?? 0;
  const openness = clamp01(1 - Math.max(blinkL, blinkR));
  return { openness, blinkL, blinkR };
}

/** Fuse EAR + blendshapes for robust open/closed read on noisy webcams. */
export function fuseEyeOpenness(
  ear: number,
  blinkOpen: number,
  trackingConfidence: number,
): { openness: number; likelyClosed: boolean } {
  const tc = clamp01(trackingConfidence);
  const earWeight = 0.55 + tc * 0.2;
  const blinkWeight = 1 - earWeight;
  const earOpen = earToScore(ear) / 100;
  const openness = clamp01(earOpen * earWeight + blinkOpen * blinkWeight);
  const closedByEar = ear > 0 && ear < (tc < 0.45 ? 0.23 : 0.25);
  const closedByBlink = blinkOpen < (tc < 0.45 ? 0.48 : 0.42);
  const likelyClosed =
    (closedByEar && closedByBlink) || (closedByBlink && blinkOpen < 0.35) || (closedByEar && ear < 0.18);
  return { openness, likelyClosed };
}

/** Both eyes clearly open — used for focus scoring floor, not sleep. */
export function bothEyesClearlyOpen(
  earL: number,
  earR: number,
  relL: number,
  relR: number,
  relMin = 0.16,
): boolean {
  if (relL < relMin && relR < relMin) return false;
  const openThresh = 0.19;
  const leftOpen = relL >= relMin && earL >= openThresh;
  const rightOpen = relR >= relMin && earR >= openThresh;
  return leftOpen && rightOpen;
}

function dampenScoresForTrackingUncertainty(
  score: number,
  eyesScore: number,
  faceScore: number,
  trackingConfidence: number,
  signalMode: SignalMode,
  eyesClearlyOpen: boolean,
): { score: number; eyesScore: number; faceScore: number } {
  const tc = Math.min(1, Math.max(0, trackingConfidence));
  if (eyesClearlyOpen && tc >= 0.28) {
    return { score, eyesScore, faceScore };
  }
  const neutral = signalMode === "uncertain" ? 58 : 56;
  const eyePreserve = eyesScore <= 22 || eyesScore >= 70 ? 0.65 : 0;
  const dampen = 1 - tc * 0.55;
  const blend = (v: number, preserve = 0) =>
    v * (1 - dampen * (1 - preserve)) + neutral * dampen * (1 - preserve);
  return {
    score: blend(score),
    eyesScore: blend(eyesScore, eyePreserve),
    faceScore: blend(faceScore),
  };
}

function scoreWeights(signalMode: SignalMode): { eyes: number; pose: number; presence: number } {
  switch (signalMode) {
    case "full":
      return { eyes: 0.5, pose: 0.3, presence: 0.2 };
    case "monocular":
      return { eyes: 0.42, pose: 0.33, presence: 0.25 };
    case "eyewear":
      return { eyes: 0.15, pose: 0.45, presence: 0.4 };
    case "pose_only":
      return { eyes: 0.08, pose: 0.35, presence: 0.57 };
    case "uncertain":
    default:
      return { eyes: 0.2, pose: 0.3, presence: 0.5 };
  }
}

export function extractFaceSignals(
  input: FaceSignalsInput,
  opts?: {
    smoothed?: {
      ear?: number;
      earL?: number;
      earR?: number;
      blinkOpen?: number;
      yaw?: number;
      pitch?: number;
    };
  },
): {
  ear: number;
  earL: number;
  earR: number;
  yaw: number;
  pitch: number;
  roll: number;
  eyesScore: number;
  faceScore: number;
  eyeBlinkAssist: number;
  eyeBlinkShutL: number;
  eyeBlinkShutR: number;
  eyeLikelyClosed: boolean;
  signalMode: SignalMode;
} {
  const { landmarks, blendshapes, transformMatrix, presence, videoWidth, videoHeight } =
    input;
  const tc = presence.trackingConfidence;

  const rawEarL = earFromIndices(landmarks, MP_LEFT_EYE_EAR, videoWidth, videoHeight);
  const rawEarR = earFromIndices(landmarks, MP_RIGHT_EYE_EAR, videoWidth, videoHeight);
  const earL = opts?.smoothed?.earL ?? rawEarL;
  const earR = opts?.smoothed?.earR ?? rawEarR;
  const fused = fuseEar(
    earL,
    earR,
    presence.eyeReliabilityL,
    presence.eyeReliabilityR,
    tc,
  );
  const ear = opts?.smoothed?.ear ?? fused.ear;
  const pose = poseFromTransformMatrix(transformMatrix);
  const blink = blendshapeEyeOpenness(blendshapes);
  const blinkOpen = opts?.smoothed?.blinkOpen ?? blink.openness;

  const fusedEye = fuseEyeOpenness(ear, blinkOpen, tc);
  const earWeight = tc < 0.45 ? 0.48 : 0.62;
  const earScore = earToScore(ear);
  const blinkScore = fusedEye.openness * 100;
  let eyesScore = Math.round(earScore * earWeight + blinkScore * (1 - earWeight));

  const yaw = opts?.smoothed?.yaw ?? pose.yaw;
  const pitch = opts?.smoothed?.pitch ?? pose.pitch;
  const yawPenalty = yaw * 52;
  const pitchPenalty = pitch * 28;
  const rollPenalty = pose.roll * 8;
  const faceRaw = 100 - yawPenalty - pitchPenalty - rollPenalty;
  const faceScore = Math.round(Math.min(100, Math.max(0, faceRaw)));

  const eyesClearlyOpen = bothEyesClearlyOpen(
    earL,
    earR,
    presence.eyeReliabilityL,
    presence.eyeReliabilityR,
    tc < 0.45 ? 0.14 : 0.16,
  );
  if (eyesClearlyOpen) {
    eyesScore = Math.max(eyesScore, Math.round(75 + tc * 18));
  }

  const signalMode =
    presence.signalMode === "uncertain"
      ? "uncertain"
      : fused.mode === "pose_only"
        ? presence.eyewearLikely
          ? "eyewear"
          : "pose_only"
        : presence.signalMode;

  if (signalMode === "eyewear" || signalMode === "pose_only") {
    eyesScore = Math.round(eyesScore * 0.55 + faceScore * 0.45);
  }

  return {
    ear,
    earL,
    earR,
    yaw,
    pitch,
    roll: pose.roll,
    eyesScore,
    faceScore,
    eyeBlinkAssist: blinkOpen,
    eyeBlinkShutL: blink.blinkL,
    eyeBlinkShutR: blink.blinkR,
    eyeLikelyClosed: false,
    signalMode,
  };
}

export function scoreFocusFromFaceSignals(
  signals: ReturnType<typeof extractFaceSignals>,
  opts: {
    focusThreshold: number;
    distractionThreshold: number;
    prevSmoothed: number | null;
    smoothAlpha: number;
    trackingConfidence: number;
    presenceQuality?: number;
  },
): FocusFrameResult {
  const weights = scoreWeights(signals.signalMode);
  const poseComponent = Math.max(0, 100 - signals.yaw * 52 - signals.pitch * 28);
  const presenceComponent = opts.trackingConfidence * 100;

  let score =
    signals.eyesScore * weights.eyes +
    poseComponent * weights.pose +
    presenceComponent * weights.presence;
  score = Math.min(100, Math.max(0, score));

  let { eyesScore, faceScore } = signals;
  const eyesClearlyOpen =
    (signals.earL >= 0.19 && signals.earR >= 0.19) || signals.eyesScore >= 70;
  const dampened = dampenScoresForTrackingUncertainty(
    score,
    eyesScore,
    faceScore,
    opts.trackingConfidence,
    signals.signalMode,
    eyesClearlyOpen,
  );
  score = dampened.score;
  eyesScore = Math.round(dampened.eyesScore);
  faceScore = Math.round(dampened.faceScore);

  const alpha = opts.smoothAlpha;
  const smoothed =
    opts.prevSmoothed === null
      ? score
      : opts.prevSmoothed * (1 - alpha) + score * alpha;

  let state: FocusSampleState = "drifting";
  if (signals.signalMode === "uncertain") {
    state = "drifting";
  } else if (smoothed >= opts.focusThreshold) state = "focused";
  else if (smoothed < opts.distractionThreshold) state = "distracted";

  const out: FocusFrameResult = {
    score: Math.round(smoothed),
    state,
    rawEar: signals.ear,
    hasFace: true,
    eyesScore,
    faceScore,
    yaw: signals.yaw,
    pitch: signals.pitch,
    trackingConfidence: opts.trackingConfidence,
    signalMode: signals.signalMode,
    earL: signals.earL,
    earR: signals.earR,
    eyeBlinkAssist: signals.eyeBlinkAssist,
  };
  out.earL = signals.earL;
  out.earR = signals.earR;
  if (opts.presenceQuality != null) out.presenceQuality = opts.presenceQuality;
  return out;
}

/** Legacy 68-point path (face-api) — kept for dev comparison only. */
export function scoreFocusFromLandmarks(
  landmarks: Landmark68 | undefined,
  expressions: Record<string, number> | undefined,
  opts: {
    focusThreshold: number;
    distractionThreshold: number;
    prevSmoothed: number | null;
    smoothAlpha: number;
    trackingConfidence?: number;
    presenceQuality?: number;
  },
): FocusFrameResult {
  if (!landmarks || landmarkPoint(landmarks, 36) == null) {
    return {
      score: 0,
      state: "away",
      rawEar: 0,
      hasFace: false,
      eyesScore: 0,
      faceScore: 0,
      yaw: 0,
      pitch: 0,
    };
  }

  const LEFT_EYE = [36, 37, 38, 39, 40, 41];
  const RIGHT_EYE = [42, 43, 44, 45, 46, 47];
  const earL = earFrom68(landmarks, LEFT_EYE);
  const earR = earFrom68(landmarks, RIGHT_EYE);
  const ear = (earL + earR) / 2;
  const earScore = earToScore(ear);

  const nose = landmarkPoint(landmarks, 30);
  const le = landmarkPoint(landmarks, 36);
  const re = landmarkPoint(landmarks, 45);
  let yaw = 0;
  let pitch = 0;
  if (nose && le && re) {
    const mid = { x: (le.x + re.x) / 2, y: (le.y + re.y) / 2 };
    const eyeDist = dist(le, re);
    if (eyeDist > 1e-6) {
      yaw = Math.min(1, Math.abs(nose.x - mid.x) / eyeDist / 0.35);
      const eyeY = (le.y + re.y) / 2;
      const expectedNoseY = eyeY + eyeDist * 0.48;
      pitch = Math.min(1, Math.abs(nose.y - expectedNoseY) / eyeDist / 0.55);
    }
  }

  const yawPenalty = yaw * 52;
  const pitchPenalty = pitch * 28;
  let exprPenalty = 0;
  if (expressions) {
    exprPenalty += (expressions.surprised ?? 0) * 12;
    exprPenalty += (expressions.sad ?? 0) * 8;
    exprPenalty += (expressions.angry ?? 0) * 6;
  }

  let eyesScore = Math.round(earScore);
  const faceRaw = 100 - yawPenalty - pitchPenalty - exprPenalty * 0.85;
  let faceScore = Math.round(Math.min(100, Math.max(0, faceRaw)));

  let score =
    earScore * 0.5 +
    Math.max(0, 100 - yawPenalty - pitchPenalty) * 0.42 -
    exprPenalty;
  score = Math.min(100, Math.max(0, score));

  const tc = opts.trackingConfidence ?? 1;
  const dampened = dampenScoresForTrackingUncertainty(
    score,
    eyesScore,
    faceScore,
    tc,
    "full",
    eyesScore >= 70,
  );
  score = dampened.score;
  eyesScore = Math.round(dampened.eyesScore);
  faceScore = Math.round(dampened.faceScore);

  const alpha = opts.smoothAlpha;
  const smoothed =
    opts.prevSmoothed === null
      ? score
      : opts.prevSmoothed * (1 - alpha) + score * alpha;

  let state: FocusSampleState = "drifting";
  if (smoothed >= opts.focusThreshold) state = "focused";
  else if (smoothed < opts.distractionThreshold) state = "distracted";

  const out: FocusFrameResult = {
    score: Math.round(smoothed),
    state,
    rawEar: ear,
    hasFace: true,
    eyesScore,
    faceScore,
    yaw,
    pitch,
    trackingConfidence: tc,
    signalMode: "full",
  };
  if (opts.presenceQuality != null) out.presenceQuality = opts.presenceQuality;
  return out;
}
