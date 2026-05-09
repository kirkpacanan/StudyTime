/**
 * Face framing & capture quality for trustworthy focus scoring.
 * Uses TinyFaceDetector confidence (pretrained) + Laplacian variance on the face ROI (sharpness).
 */

export type FacePresenceSignals = {
  /** Raw TinyFaceDetector score (~0–1). */
  detectionConfidence: number;
  /** Face box area / frame area (object-cover safe: approximate video frame). */
  frameCoverage: number;
  /** Normalized sharpness 0–1 (higher = clearer focus / less blur). */
  sharpnessScore: number;
  /** Composite 0–100 for UX/debug. */
  presenceQuality: number;
  /** Blend weight for trusting landmark-derived scores this frame (0–1). */
  trackingConfidence: number;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Coverage peak ~12–22% of frame — typical head-and-shoulders framing. */
function coverageQuality(coverage: number): number {
  if (coverage <= 0) return 0;
  if (coverage < 0.015) return clamp01((coverage - 0.004) / 0.011);
  if (coverage <= 0.28) {
    const ideal = 0.14;
    const spread = 0.14;
    return clamp01(1 - Math.abs(coverage - ideal) / spread);
  }
  if (coverage <= 0.55) return clamp01(1 - (coverage - 0.28) / 0.35);
  return clamp01(1 - (coverage - 0.55) / 0.45);
}

/** Laplacian variance on downscaled grayscale patch — higher = sharper. */
export function laplacianVarianceFaceRoi(
  video: HTMLVideoElement,
  box: { x: number; y: number; width: number; height: number },
  outCanvas?: HTMLCanvasElement | null,
): number {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || box.width < 8 || box.height < 8) return 0;

  let sx = Math.floor(box.x);
  let sy = Math.floor(box.y);
  let sw = Math.ceil(box.width);
  let sh = Math.ceil(box.height);
  sx = Math.max(0, Math.min(vw - 1, sx));
  sy = Math.max(0, Math.min(vh - 1, sy));
  sw = Math.max(8, Math.min(vw - sx, sw));
  sh = Math.max(8, Math.min(vh - sy, sh));

  const W = 72;
  const H = 72;
  const canvas = outCanvas ?? document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const gray = new Float32Array(W * H);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    gray[i] = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
  }

  let sumSq = 0;
  let n = 0;
  const step = 2;
  for (let y = 1; y < H - 1; y += step) {
    for (let x = 1; x < W - 1; x += step) {
      const i = y * W + x;
      const lap =
        -4 * gray[i] +
        gray[i - 1] +
        gray[i + 1] +
        gray[i - W] +
        gray[i + W];
      sumSq += lap * lap;
      n++;
    }
  }
  return n > 0 ? sumSq / n : 0;
}

/** Map raw Laplacian variance to ~0–1 (tuned for 72² crops @ laptop webcam). */
export function normalizeSharpness(rawVariance: number): number {
  if (rawVariance <= 0) return 0;
  const scaled = Math.log1p(rawVariance) / Math.log1p(280);
  return clamp01(scaled);
}

export function computeFacePresenceSignals(
  detectionConfidence: number,
  box: { x: number; y: number; width: number; height: number } | undefined,
  videoWidth: number,
  videoHeight: number,
  sharpnessNormalized: number,
): FacePresenceSignals {
  const det = clamp01(detectionConfidence);
  let cov = 0;
  if (box && videoWidth > 0 && videoHeight > 0) {
    cov = (box.width * box.height) / (videoWidth * videoHeight);
  }
  const covQ = coverageQuality(cov);
  const sharp = clamp01(sharpnessNormalized);

  const trackingConfidence = clamp01(
    det * 0.42 + covQ * 0.33 + sharp * 0.25,
  );

  const presenceQuality = Math.round(
    100 *
      clamp01(det * 0.38 + covQ * 0.32 + sharp * 0.3),
  );

  return {
    detectionConfidence: det,
    frameCoverage: cov,
    sharpnessScore: sharp,
    presenceQuality,
    trackingConfidence,
  };
}
