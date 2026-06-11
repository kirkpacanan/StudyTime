import { withMediapipeQuietAsync } from "@/lib/mediapipe-quiet";

const MEDIAPIPE_VISION_WASM = "/mediapipe/wasm";
const FACE_LANDMARKER_MODEL = "/models/face_landmarker/face_landmarker.task";

export type NormalizedLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type FaceLandmarkerFrame = {
  landmarks: NormalizedLandmark[];
  /** Pixel-space bounding box in video coordinates. */
  box: { x: number; y: number; width: number; height: number };
  detectionConfidence: number;
  blendshapes: Record<string, number>;
  /** 4x4 row-major facial transformation matrix. */
  transformMatrix: number[] | null;
};

type FaceLandmarkerInstance = {
  detectForVideo: (
    frame: HTMLVideoElement,
    timestampMs: number,
  ) => {
    faceLandmarks?: NormalizedLandmark[][];
    faceBlendshapes?: Array<{ categories: Array<{ categoryName: string; score: number }> }>;
    facialTransformationMatrixes?: Array<{ data: Float32Array | number[] }>;
  };
  close?: () => void;
};

let landmarkerSingleton: FaceLandmarkerInstance | null = null;
let landmarkerLoadPromise: Promise<FaceLandmarkerInstance | null> | null = null;

function blendshapesToRecord(
  categories: Array<{ categoryName: string; score: number }> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!categories) return out;
  for (const c of categories) {
    if (c.categoryName) out[c.categoryName] = c.score;
  }
  return out;
}

function boxFromLandmarks(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
): { x: number; y: number; width: number; height: number } {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of landmarks) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 0.04;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(1, maxX + pad);
  maxY = Math.min(1, maxY + pad);
  return {
    x: minX * videoWidth,
    y: minY * videoHeight,
    width: (maxX - minX) * videoWidth,
    height: (maxY - minY) * videoHeight,
  };
}

export async function getFaceLandmarker(): Promise<FaceLandmarkerInstance | null> {
  if (landmarkerSingleton) return landmarkerSingleton;
  if (landmarkerLoadPromise) return landmarkerLoadPromise;

  landmarkerLoadPromise = (async () => {
    try {
      const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
      const instance = await withMediapipeQuietAsync(async () => {
        const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_VISION_WASM, false);
        return FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL },
          runningMode: "VIDEO",
          numFaces: 2,
          /** Lower thresholds help dim / low-res webcams still lock a face. */
          minFaceDetectionConfidence: 0.25,
          minFacePresenceConfidence: 0.25,
          minTrackingConfidence: 0.25,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
      });
      landmarkerSingleton = instance as FaceLandmarkerInstance;
      return landmarkerSingleton;
    } catch {
      landmarkerLoadPromise = null;
      return null;
    }
  })();

  return landmarkerLoadPromise;
}

export function disposeFaceLandmarker(): void {
  try {
    landmarkerSingleton?.close?.();
  } catch {
    /* ignore */
  }
  landmarkerSingleton = null;
  landmarkerLoadPromise = null;
}

export type FaceLandmarkerDetectResult = {
  frame: FaceLandmarkerFrame | null;
  faceCount: number;
};

export function detectFaceLandmarks(
  landmarker: FaceLandmarkerInstance,
  video: HTMLVideoElement,
  timestampMs: number,
): FaceLandmarkerDetectResult {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || video.readyState < 2) return { frame: null, faceCount: 0 };

  const result = landmarker.detectForVideo(video, timestampMs);
  const faceCount = result.faceLandmarks?.length ?? 0;
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks?.length) return { frame: null, faceCount };

  const blendshapes = blendshapesToRecord(result.faceBlendshapes?.[0]?.categories);
  const matrixRaw = result.facialTransformationMatrixes?.[0]?.data;
  const transformMatrix = matrixRaw
    ? Array.from(matrixRaw as ArrayLike<number>).map(Number)
    : null;

  const visibilityAvg =
    landmarks.reduce((s, p) => s + (p.visibility ?? 0.82), 0) / landmarks.length;
  const blinkL = blendshapes.eyeBlinkLeft ?? 0;
  const blinkR = blendshapes.eyeBlinkRight ?? 0;
  const blendActive = blinkL > 0.02 || blinkR > 0.02 ? 0.12 : 0;
  const landmarkDensity = landmarks.length >= 468 ? 0.08 : 0;

  return {
    frame: {
      landmarks,
      box: boxFromLandmarks(landmarks, vw, vh),
      detectionConfidence: Math.min(
        1,
        Math.max(0.28, visibilityAvg * 0.82 + blendActive + landmarkDensity),
      ),
      blendshapes,
      transformMatrix,
    },
    faceCount,
  };
}
