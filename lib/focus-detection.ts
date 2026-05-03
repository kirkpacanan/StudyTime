import type { FocusSampleState } from "./types";

export type FocusFrameResult = {
  score: number;
  state: FocusSampleState;
  rawEar: number;
  hasFace: boolean;
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

export function scoreFocusFromLandmarks(
  landmarks: Landmark68 | undefined,
  expressions: Record<string, number> | undefined,
  opts: {
    focusThreshold: number;
    distractionThreshold: number;
    prevSmoothed: number | null;
    smoothAlpha: number;
  },
): FocusFrameResult {
  if (!landmarks || landmarkPoint(landmarks, 36) == null) {
    return {
      score: 0,
      state: "away",
      rawEar: 0,
      hasFace: false,
    };
  }

  const earL = eyeAspectRatio(landmarks, LEFT_EYE);
  const earR = eyeAspectRatio(landmarks, RIGHT_EYE);
  const ear = (earL + earR) / 2;

  const earScore = Math.min(
    100,
    Math.max(0, ((ear - 0.17) / (0.32 - 0.17)) * 100),
  );

  const yawPenalty = headYawScore(landmarks) * 55;
  let exprPenalty = 0;
  if (expressions) {
    exprPenalty += (expressions.surprised ?? 0) * 12;
    exprPenalty += (expressions.sad ?? 0) * 8;
    exprPenalty += (expressions.angry ?? 0) * 6;
  }

  let score = earScore * 0.55 + (100 - yawPenalty) * 0.45 - exprPenalty;
  score = Math.min(100, Math.max(0, score));

  const alpha = opts.smoothAlpha;
  const smoothed =
    opts.prevSmoothed === null
      ? score
      : opts.prevSmoothed * (1 - alpha) + score * alpha;

  let state: FocusSampleState = "drifting";
  if (smoothed >= opts.focusThreshold) state = "focused";
  else if (smoothed < opts.distractionThreshold) state = "distracted";

  return {
    score: Math.round(smoothed),
    state,
    rawEar: ear,
    hasFace: true,
  };
}
