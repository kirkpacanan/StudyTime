/**
 * Sleep-specific eye closure — EAR only, both eyes required.
 * Blendshapes are excluded here; they often read "partial blink" on open eyes
 * with low-quality webcams and caused false sleep triggers.
 */

export type SleepEyeState = {
  /** Both trackable eyes read shut via EAR. */
  bothClosed: boolean;
  /** Both trackable eyes read clearly open via EAR. */
  bothOpen: boolean;
  /** At least one eye reads clearly open — releases sleep hysteresis. */
  anyOpen: boolean;
  confidence: number;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Closed only when EAR is genuinely low (lids together), not "soft" webcam open reads. */
const EAR_SLEEP_CLOSED = 0.175;
/** Open when EAR clears this on each eye — lower than typical focus EAR thresh. */
const EAR_SLEEP_OPEN = 0.205;
const REL_MIN = 0.16;

export function detectSleepEyeState(
  earL: number,
  earR: number,
  relL: number,
  relR: number,
): SleepEyeState {
  const bothReliable = relL >= REL_MIN && relR >= REL_MIN;
  if (!bothReliable) {
    return { bothClosed: false, bothOpen: false, anyOpen: false, confidence: 0 };
  }

  const leftValid = earL > 0.04;
  const rightValid = earR > 0.04;
  if (!leftValid || !rightValid) {
    return { bothClosed: false, bothOpen: false, anyOpen: false, confidence: 0 };
  }

  const bothClosed = earL < EAR_SLEEP_CLOSED && earR < EAR_SLEEP_CLOSED;
  const bothOpen = earL >= EAR_SLEEP_OPEN && earR >= EAR_SLEEP_OPEN;
  const anyOpen = earL >= EAR_SLEEP_OPEN || earR >= EAR_SLEEP_OPEN;

  return {
    bothClosed,
    bothOpen,
    anyOpen,
    confidence: clamp01(Math.min(relL, relR)),
  };
}
