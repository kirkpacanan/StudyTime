/** Exponential moving average — null prev returns next unchanged. */
export function ema(prev: number | null, next: number, alpha: number): number {
  if (prev === null || !Number.isFinite(prev)) return next;
  if (!Number.isFinite(next)) return prev;
  return prev * (1 - alpha) + next * alpha;
}

export type SmoothedFaceMetrics = {
  ear: number;
  earL: number;
  earR: number;
  blinkOpen: number;
  yaw: number;
  pitch: number;
};

export class FaceMetricsSmoother {
  private ear: number | null = null;
  private earL: number | null = null;
  private earR: number | null = null;
  private blinkOpen: number | null = null;
  private yaw: number | null = null;
  private pitch: number | null = null;

  reset() {
    this.ear = null;
    this.earL = null;
    this.earR = null;
    this.blinkOpen = null;
    this.yaw = null;
    this.pitch = null;
  }

  /**
   * Adaptive alpha: smoother when tracking is noisy (low confidence), snappier when crisp.
   */
  push(
    raw: {
      ear: number;
      earL: number;
      earR: number;
      blinkOpen: number;
      yaw: number;
      pitch: number;
    },
    trackingConfidence: number,
  ): SmoothedFaceMetrics {
    const tc = Math.min(1, Math.max(0, trackingConfidence));
    const earAlpha = 0.22 + tc * 0.18;
    const blinkAlpha = 0.35 + tc * 0.2;
    const poseAlpha = 0.28 + tc * 0.12;

    this.ear = ema(this.ear, raw.ear, earAlpha);
    this.earL = ema(this.earL, raw.earL, earAlpha);
    this.earR = ema(this.earR, raw.earR, earAlpha);
    this.blinkOpen = ema(this.blinkOpen, raw.blinkOpen, blinkAlpha);
    this.yaw = ema(this.yaw, raw.yaw, poseAlpha);
    this.pitch = ema(this.pitch, raw.pitch, poseAlpha);

    return {
      ear: this.ear,
      earL: this.earL,
      earR: this.earR,
      blinkOpen: this.blinkOpen,
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }
}
