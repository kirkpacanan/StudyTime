import type { FocusSampleState } from "./types";

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
};

export type Landmark68 = {
  getPosition?: (index: number) => { x: number; y: number };
  positions?: ReadonlyArray<{ x: number; y: number }>;
};

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

const LEFT_EYE = [36, 37, 38, 39, 40, 41];
const RIGHT_EYE = [42, 43, 44, 45, 46, 47];

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(landmarks: Landmark68, indices: number[]): number {
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

/** Rough head yaw: nose vs midpoint of eyes, normalized by inter-eye distance */
function headYawScore(landmarks: Landmark68): number {
  const nose = landmarkPoint(landmarks, 30);
  const le = landmarkPoint(landmarks, 36);
  const re = landmarkPoint(landmarks, 45);
  if (!nose || !le || !re) return 0;
  const mid = { x: (le.x + re.x) / 2, y: (le.y + re.y) / 2 };
  const eyeDist = dist(le, re);
  if (eyeDist < 1e-6) return 0;
  const offset = Math.abs(nose.x - mid.x) / eyeDist;
  return Math.min(1, offset / 0.35);
}

/** Rough vertical head pose: nose vs expected depth from eye line (looking down/up away from screen) */
function headPitchScore(landmarks: Landmark68): number {
  const le = landmarkPoint(landmarks, 36);
  const re = landmarkPoint(landmarks, 45);
  const nose = landmarkPoint(landmarks, 30);
  if (!le || !re || !nose) return 0;
  const eyeY = (le.y + re.y) / 2;
  const eyed = dist(le, re);
  if (eyed < 1e-6) return 0;
  const expectedNoseY = eyeY + eyed * 0.48;
  const dev = Math.abs(nose.y - expectedNoseY) / eyed;
  return Math.min(1, dev / 0.55);
}

function dampenScoresForTrackingUncertainty(
  score: number,
  eyesScore: number,
  faceScore: number,
  trackingConfidence: number,
): { score: number; eyesScore: number; faceScore: number } {
  const tc = Math.min(1, Math.max(0, trackingConfidence));
  const neutral = 54;
  const blend = (v: number) => v * tc + neutral * (1 - tc);
  return {
    score: blend(score),
    eyesScore: blend(eyesScore),
    faceScore: blend(faceScore),
  };
}

export function scoreFocusFromLandmarks(
  landmarks: Landmark68 | undefined,
  expressions: Record<string, number> | undefined,
  opts: {
    focusThreshold: number;
    distractionThreshold: number;
    prevSmoothed: number | null;
    smoothAlpha: number;
    /** 0–1 trust in landmarks this frame (detector conf × framing × sharpness). Default 1. */
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

  const earL = eyeAspectRatio(landmarks, LEFT_EYE);
  const earR = eyeAspectRatio(landmarks, RIGHT_EYE);
  const ear = (earL + earR) / 2;

  const earScore = Math.min(
    100,
    Math.max(0, ((ear - 0.17) / (0.32 - 0.17)) * 100),
  );

  const yaw = headYawScore(landmarks);
  const pitch = headPitchScore(landmarks);
  const yawPenalty = yaw * 52;
  const pitchPenalty = pitch * 28;
  let exprPenalty = 0;
  if (expressions) {
    exprPenalty += (expressions.surprised ?? 0) * 12;
    exprPenalty += (expressions.sad ?? 0) * 8;
    exprPenalty += (expressions.angry ?? 0) * 6;
  }

  let eyesScore = Math.round(earScore);
  const faceRaw =
    100 - yawPenalty - pitchPenalty - exprPenalty * 0.85;
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
  };
  if (opts.presenceQuality != null) out.presenceQuality = opts.presenceQuality;
  return out;
}
