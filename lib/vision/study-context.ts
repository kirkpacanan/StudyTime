export type StudyContextMode =
  | "screen_focus"
  | "desk_work"
  | "gaze_shift"
  | "away"
  | "drowsy"
  | "uncertain";

export type StudyContextInput = {
  hasFace: boolean;
  pitch: number;
  yaw: number;
  eyesOpen: boolean;
  eyesScore: number;
  faceScore: number;
  phoneDetected: boolean;
  drowsy: boolean;
  noFaceMs: number;
  headDownMs: number;
  lookingAwayMs: number;
  blinkRatePerMin: number;
  trackingConfidence: number;
  deskWorkBias: boolean;
  /** Pitch above this suggests looking at desk/notes. */
  deskPitchMin?: number;
  deskPitchMax?: number;
};

const DEFAULT_DESK_PITCH_MIN = 0.38;
const DEFAULT_DESK_PITCH_MAX = 0.82;

export function classifyStudyContext(input: StudyContextInput): StudyContextMode {
  const {
    hasFace,
    pitch,
    yaw,
    eyesOpen,
    eyesScore,
    faceScore,
    phoneDetected,
    drowsy,
    noFaceMs,
    headDownMs,
    lookingAwayMs,
    blinkRatePerMin,
    trackingConfidence,
    deskWorkBias,
  } = input;

  const deskMin = input.deskPitchMin ?? DEFAULT_DESK_PITCH_MIN;
  const deskMax = input.deskPitchMax ?? DEFAULT_DESK_PITCH_MAX;

  if (!hasFace && noFaceMs >= 3_000) return "away";
  if (trackingConfidence < 0.35 && hasFace) return "uncertain";
  if (drowsy) return "drowsy";

  const deskPitch = pitch >= deskMin && pitch <= deskMax;
  const normalBlinks = blinkRatePerMin >= 4 && blinkRatePerMin <= 35;
  const deskWork =
    hasFace &&
    deskPitch &&
    eyesOpen &&
    eyesScore >= 45 &&
    faceScore >= 45 &&
    !phoneDetected &&
    headDownMs < 120_000 &&
    (normalBlinks || blinkRatePerMin === 0) &&
    (deskWorkBias || headDownMs >= 800);

  if (deskWork) return "desk_work";

  if (lookingAwayMs >= 3_000 && yaw >= 0.55) return "gaze_shift";
  if (hasFace && yaw <= 0.55 && pitch <= 0.57 && eyesScore >= 55) return "screen_focus";

  return "gaze_shift";
}

export function isDeskWorkMode(mode: StudyContextMode): boolean {
  return mode === "desk_work";
}
