/**
 * Face framing & capture quality for trustworthy focus scoring.
 * Uses detector confidence + Laplacian variance on the face ROI (sharpness).
 */

import type { NormalizedLandmark } from "@/lib/vision/face-landmarker";
import { MP_LEFT_EYE_EAR, MP_RIGHT_EYE_EAR } from "@/lib/vision/landmark-indices";
import type { SignalMode } from "@/lib/focus-detection";

export type FacePresenceSignals = {
  /** Raw detector / visibility confidence (~0–1). */
  detectionConfidence: number;
  /** Face box area / frame area (object-cover safe: approximate video frame). */
  frameCoverage: number;
  /** Normalized sharpness 0–1 (higher = clearer focus / less blur). */
  sharpnessScore: number;
  /** Composite 0–100 for UX/debug. */
  presenceQuality: number;
  /** Blend weight for trusting landmark-derived scores this frame (0–1). */
  trackingConfidence: number;
  eyeReliabilityL: number;
  eyeReliabilityR: number;
  poseReliability: number;
  eyewearLikely: boolean;
  signalMode: SignalMode;
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
  // Lower reference (120) keeps usable signal on soft / noisy webcams.
  const scaled = Math.log1p(rawVariance) / Math.log1p(120);
  return clamp01(scaled);
}

/** Eye-region sharpness from landmark bounding box (normalized coords). */
export function eyeRegionSharpness(
  video: HTMLVideoElement,
  landmarks: NormalizedLandmark[] | undefined,
  indices: readonly number[],
  outCanvas?: HTMLCanvasElement | null,
): number {
  if (!landmarks?.length) return 0;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return 0;

  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let n = 0;
  for (const i of indices) {
    const p = landmarks[i];
    if (!p) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    n++;
  }
  if (n < 4) return 0;

  const pad = 0.015;
  const box = {
    x: Math.max(0, (minX - pad) * vw),
    y: Math.max(0, (minY - pad) * vh),
    width: Math.min(vw, (maxX - minX + 2 * pad) * vw),
    height: Math.min(vh, (maxY - minY + 2 * pad) * vh),
  };
  if (box.width < 6 || box.height < 6) return 0;
  return normalizeSharpness(laplacianVarianceFaceRoi(video, box, outCanvas));
}

function eyeVisibilityFromLandmarks(
  landmarks: NormalizedLandmark[] | undefined,
  indices: readonly number[],
): number {
  if (!landmarks?.length) return 0;
  let sum = 0;
  let n = 0;
  for (const i of indices) {
    const p = landmarks[i];
    if (!p) continue;
    sum += p.visibility ?? 0.78;
    n++;
  }
  return n >= 4 ? clamp01(sum / n) : 0;
}

function eyeGeometricPlausibility(
  landmarks: NormalizedLandmark[] | undefined,
  indices: readonly number[],
  videoWidth: number,
  videoHeight: number,
): number {
  if (!landmarks?.length || videoWidth <= 0 || videoHeight <= 0) return 0;
  const pts = indices
    .map((i) => landmarks[i])
    .filter((p): p is NormalizedLandmark => !!p)
    .map((p) => ({ x: p.x * videoWidth, y: p.y * videoHeight }));
  if (pts.length < 6) return 0;
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const v1 = dist(pts[1], pts[5]);
  const v2 = dist(pts[2], pts[4]);
  const h = dist(pts[0], pts[3]);
  if (h < 2) return 0;
  const ear = (v1 + v2) / (2 * h);
  // Open eyes ~0.14–0.42; closed ~0.05–0.18 — either is “measurable”.
  if (ear >= 0.04 && ear <= 0.55) return 0.75;
  if (ear > 0 && ear < 0.65) return 0.45;
  return 0.2;
}

function computeEyeReliability(
  landmarks: NormalizedLandmark[] | undefined,
  indices: readonly number[],
  videoWidth: number,
  videoHeight: number,
  eyeSharpness: number,
  blendshapeBlink: number,
): number {
  const vis = eyeVisibilityFromLandmarks(landmarks, indices);
  const geom = eyeGeometricPlausibility(landmarks, indices, videoWidth, videoHeight);
  const sharp = clamp01(eyeSharpness);
  const blendBoost = blendshapeBlink > 0.04 ? 0.14 : blendshapeBlink > 0.01 ? 0.08 : 0;
  return clamp01(vis * 0.38 + geom * 0.34 + sharp * 0.2 + blendBoost);
}

export function resolveSignalMode(
  eyeReliabilityL: number,
  eyeReliabilityR: number,
  trackingConfidence: number,
  eyewearLikely: boolean,
): SignalMode {
  const maxEye = Math.max(eyeReliabilityL, eyeReliabilityR);
  const minEye = Math.min(eyeReliabilityL, eyeReliabilityR);
  const bothLow = maxEye < 0.18;
  if (trackingConfidence < 0.22) return "uncertain";
  if (eyewearLikely && bothLow) return "eyewear";
  if (maxEye < 0.18) return "pose_only";
  if (minEye < 0.32 && maxEye >= 0.32) return "monocular";
  if (minEye < 0.38) return "monocular";
  return "full";
}

export function computeFacePresenceSignals(
  detectionConfidence: number,
  box: { x: number; y: number; width: number; height: number } | undefined,
  videoWidth: number,
  videoHeight: number,
  sharpnessNormalized: number,
  opts?: {
    landmarks?: NormalizedLandmark[];
    poseStability?: number;
    blendshapeEyeBlink?: number;
    blendshapeBlinkL?: number;
    blendshapeBlinkR?: number;
    eyeSharpnessL?: number;
    eyeSharpnessR?: number;
  },
): FacePresenceSignals {
  const det = clamp01(detectionConfidence);
  let cov = 0;
  if (box && videoWidth > 0 && videoHeight > 0) {
    cov = (box.width * box.height) / (videoWidth * videoHeight);
  }
  const covQ = coverageQuality(cov);
  const sharp = clamp01(sharpnessNormalized);
  const blinkL = opts?.blendshapeBlinkL ?? opts?.blendshapeEyeBlink ?? 0;
  const blinkR = opts?.blendshapeBlinkR ?? opts?.blendshapeEyeBlink ?? 0;

  const eyeReliabilityL = computeEyeReliability(
    opts?.landmarks,
    MP_LEFT_EYE_EAR,
    videoWidth,
    videoHeight,
    opts?.eyeSharpnessL ?? sharp * 0.85,
    blinkL,
  );
  const eyeReliabilityR = computeEyeReliability(
    opts?.landmarks,
    MP_RIGHT_EYE_EAR,
    videoWidth,
    videoHeight,
    opts?.eyeSharpnessR ?? sharp * 0.85,
    blinkR,
  );
  const poseReliability = clamp01((opts?.poseStability ?? 0.75) * det);

  const eyewearLikely =
    det >= 0.42 &&
    eyeReliabilityL < 0.28 &&
    eyeReliabilityR < 0.28 &&
    covQ >= 0.32 &&
    sharp >= 0.18;

  const trackingConfidence = clamp01(
    det * 0.3 +
      covQ * 0.24 +
      sharp * 0.18 +
      Math.max(eyeReliabilityL, eyeReliabilityR) * 0.18 +
      poseReliability * 0.1,
  );

  const presenceQuality = Math.round(
    100 * clamp01(det * 0.34 + covQ * 0.28 + sharp * 0.26 + trackingConfidence * 0.12),
  );

  const signalMode = resolveSignalMode(
    eyeReliabilityL,
    eyeReliabilityR,
    trackingConfidence,
    eyewearLikely,
  );

  return {
    detectionConfidence: det,
    frameCoverage: cov,
    sharpnessScore: sharp,
    presenceQuality,
    trackingConfidence,
    eyeReliabilityL,
    eyeReliabilityR,
    poseReliability,
    eyewearLikely,
    signalMode,
  };
}
