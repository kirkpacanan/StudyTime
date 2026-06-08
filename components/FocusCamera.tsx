"use client";

import {
  extractFaceSignals,
  poseFromTransformMatrix,
  scoreFocusFromFaceSignals,
  scoreFocusFromLandmarks,
  type Landmark68,
  type SignalMode,
} from "@/lib/focus-detection";
import type { FocusFrameResult } from "@/lib/focus-detection";
import {
  FocusAttentionEngine,
  type AttentionFrameResult,
} from "@/lib/focus-attention-engine";
import {
  computeFacePresenceSignals,
  eyeRegionSharpness,
  laplacianVarianceFaceRoi,
  normalizeSharpness,
} from "@/lib/face-presence-quality";
import { FaceMetricsSmoother } from "@/lib/vision/temporal-smooth";
import type { FocusSensitivity } from "@/lib/types";
import {
  detectFaceLandmarks,
  disposeFaceLandmarker,
  getFaceLandmarker,
  type FaceLandmarkerFrame,
  type NormalizedLandmark,
} from "@/lib/vision/face-landmarker";
import { useFaceLandmarkerPrimary } from "@/lib/vision/feature-flag";
import { MP_LEFT_EYE_EAR, MP_RIGHT_EYE_EAR } from "@/lib/vision/landmark-indices";
import { withMediapipeQuiet, withMediapipeQuietAsync } from "@/lib/mediapipe-quiet";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  enabled: boolean;
  active: boolean;
  phoneDetectionEnabled?: boolean;
  focusThreshold: number;
  distractionThreshold: number;
  focusSensitivity?: FocusSensitivity;
  deskWorkBias?: boolean;
  onSample: (sample: FocusFrameResult) => void;
  /** Glass footer styling for session library overlay */
  variant?: "default" | "glass";
};

const AWAY_MS = 5000;
/** Brief dropout hold — keeps face lock on noisy frames. */
const FACE_HOLD_MS = 450;
/** Runs phone OD every 1.5 s — lighter on low-spec CPUs. */
const PHONE_DETECT_EVERY_MS = 1500;
/** ROI sharpness check — every 500 ms is enough for low-spec. */
const ROI_SHARPNESS_EVERY_MS = 500;
const PARITY_LOG_EVERY_MS = 4_000;
/** Inference interval: ~2.5 Hz — enough for sleep/focus, half the CPU of 4 Hz. */
const TICK_INTERVAL_MS = 400;
/** Cap canvas DPR so HUD never renders at 2× on retina low-spec machines. */
const MAX_HUD_DPR = 1.5;
/** Vendored from `node_modules/@mediapipe/tasks-vision/wasm` via `npm run vendor:ml`. */
const MEDIAPIPE_VISION_WASM = "/mediapipe/wasm";
const PHONE_OD_MODEL_URL = "/models/object_detector/efficientdet_lite2.tflite";
const PHONE_OD_SCORE_THRESHOLD = 0.28;
const PHONE_HOLD_MS = 3500;
const PHONE_SCORE_THRESHOLD = 0.23;
const PHONE_HITS_WINDOW_MS = 2500;
const PHONE_HITS_TO_TRIGGER = 2;
const SSD_MIN_CONFIDENCE = 0.32;

const landmarkerPrimary = useFaceLandmarkerPrimary();

function isPhoneObjectLabel(categoryName: string): boolean {
  const n = categoryName.trim().toLowerCase();
  return n === "cell phone" || n === "mobile phone";
}

function expressionsToRecord(
  ex: unknown,
): Record<string, number> | undefined {
  if (!ex || typeof ex !== "object") return undefined;
  const o = ex as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "number" && !Number.isNaN(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function mapVideoPointToCover(
  video: HTMLVideoElement,
  elW: number,
  elH: number,
  px: number,
  py: number,
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || !elW || !elH) return { x: 0, y: 0 };
  const vr = vw / vh;
  const er = elW / elH;
  let scale: number;
  let offX = 0;
  let offY = 0;
  if (vr > er) {
    scale = elH / vh;
    offX = (elW - vw * scale) / 2;
  } else {
    scale = elW / vw;
    offY = (elH - vh * scale) / 2;
  }
  return { x: px * scale + offX, y: py * scale + offY };
}

function drawLandmarkerHud(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  frame: FaceLandmarkerFrame,
  phoneBox?: { x: number; y: number; width: number; height: number; score?: number } | null,
) {
  const wrap = canvas.parentElement;
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const dpr = Math.min(
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    MAX_HUD_DPR,
  );
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const box = frame.box;
  const p1 = mapVideoPointToCover(video, w, h, box.x, box.y);
  const p2 = mapVideoPointToCover(video, w, h, box.x + box.width, box.y + box.height);
  ctx.strokeStyle = "rgba(59, 130, 246, 0.92)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
  ctx.setLineDash([]);

  if (phoneBox) {
    const q1 = mapVideoPointToCover(video, w, h, phoneBox.x, phoneBox.y);
    const q2 = mapVideoPointToCover(
      video,
      w,
      h,
      phoneBox.x + phoneBox.width,
      phoneBox.y + phoneBox.height,
    );
    ctx.strokeStyle = "rgba(239, 68, 68, 0.95)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(q1.x, q1.y, q2.x - q1.x, q2.y - q1.y);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
    ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    const label = `phone${phoneBox.score != null ? ` ${(phoneBox.score * 100).toFixed(0)}%` : ""}`;
    ctx.fillText(label, q1.x + 6, Math.max(14, q1.y - 8));
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const vr = vw / vh;
  const er = w / h;
  const coverScale = vr > er ? h / vh : w / vw;

  const eyeRadius = (idxs: readonly number[], landmarks: NormalizedLandmark[]) => {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const i of idxs) {
      const p = landmarks[i];
      if (p) {
        sx += p.x * vw;
        sy += p.y * vh;
        n++;
      }
    }
    if (!n) return null;
    const cx = sx / n;
    const cy = sy / n;
    const p0 = landmarks[idxs[0]!];
    const p3 = landmarks[idxs[3]!];
    const eyeW =
      p0 && p3 ? Math.hypot((p3.x - p0.x) * vw, (p3.y - p0.y) * vh) : 28;
    const r = Math.max(7, eyeW * 0.36 * coverScale);
    const c = mapVideoPointToCover(video, w, h, cx, cy);
    return { ...c, r };
  };

  const le = eyeRadius(MP_LEFT_EYE_EAR, frame.landmarks);
  const re = eyeRadius(MP_RIGHT_EYE_EAR, frame.landmarks);
  ctx.strokeStyle = "rgba(34, 211, 238, 0.88)";
  ctx.lineWidth = 2;
  for (const e of [le, re]) {
    if (!e) continue;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function clearHud(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
}

function signalModeLabel(mode: SignalMode | undefined): string | null {
  if (!mode || mode === "full") return null;
  if (mode === "monocular") return "One-eye tracking";
  if (mode === "eyewear") return "Limited eye tracking";
  if (mode === "pose_only") return "Pose-only tracking";
  if (mode === "uncertain") return "Uncertain tracking";
  return null;
}

export function FocusCamera({
  enabled,
  active,
  phoneDetectionEnabled = true,
  focusThreshold,
  distractionThreshold,
  focusSensitivity = "balanced",
  deskWorkBias = true,
  onSample,
  variant = "default",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const smoothedRef = useRef<number | null>(null);
  const lastFaceAtRef = useRef<number>(Date.now());
  const engineRef = useRef<FocusAttentionEngine>(new FocusAttentionEngine());
  const faceLandmarkerRef = useRef<Awaited<ReturnType<typeof getFaceLandmarker>>>(null);
  const faceVideoTsRef = useRef<number>(0);
  const lastYawRef = useRef<number | null>(null);
  const lastParityLogAtRef = useRef<number>(0);
  const lastPhoneTickAtRef = useRef<number>(0);
  const phoneVideoTsRef = useRef<number>(0);
  const phoneDetectedUntilRef = useRef<number>(0);
  const phoneModelRef = useRef<unknown>(null);
  const phoneInFlightRef = useRef<boolean>(false);
  const phoneFailCountRef = useRef<number>(0);
  const phoneDisabledRef = useRef<boolean>(false);
  const roiQualityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const eyeSharpnessCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastSharpNormRef = useRef<number>(0.55);
  const lastRoiQualityMsRef = useRef<number>(0);
  const lastMpFrameRef = useRef<FaceLandmarkerFrame | null>(null);
  const lastMpFrameAtRef = useRef<number>(0);
  const metricsSmootherRef = useRef(new FaceMetricsSmoother());
  const trackingConfidenceEmaRef = useRef<number>(0.72);

  const phoneHitTimesRef = useRef<number[]>([]);
  const phoneScoreEmaRef = useRef<number>(0);
  const phoneBoxRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    score?: number;
  } | null>(null);
  const [phoneUi, setPhoneUi] = useState<{
    enabled: boolean;
    status: "idle" | "loading" | "ready" | "detected" | "error" | "disabled";
    lastScore: number | null;
  }>({ enabled: true, status: "idle", lastScore: null });
  const [signalModeUi, setSignalModeUi] = useState<SignalMode>("full");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const onSampleRef = useRef(onSample);

  useEffect(() => {
    if (enabled && modelsReady && active) {
      lastFaceAtRef.current = Date.now();
      smoothedRef.current = null;
      engineRef.current.reset();
      phoneDetectedUntilRef.current = 0;
      lastPhoneTickAtRef.current = 0;
      phoneInFlightRef.current = false;
      phoneFailCountRef.current = 0;
      phoneDisabledRef.current = false;
      phoneHitTimesRef.current = [];
      phoneScoreEmaRef.current = 0;
      phoneVideoTsRef.current = 0;
      phoneBoxRef.current = null;
      faceVideoTsRef.current = 0;
      lastYawRef.current = null;
      lastParityLogAtRef.current = 0;
      setPhoneUi({ enabled: true, status: "idle", lastScore: null });
      setSignalModeUi("full");
      lastSharpNormRef.current = 0.55;
      lastRoiQualityMsRef.current = 0;
      lastMpFrameRef.current = null;
      lastMpFrameAtRef.current = 0;
      metricsSmootherRef.current.reset();
      trackingConfidenceEmaRef.current = 0.72;
    }
  }, [enabled, modelsReady, active]);
  onSampleRef.current = onSample;

  const runPhoneDetection = useCallback(
    async (video: HTMLVideoElement, nowMs: number) => {
      if (phoneDisabledRef.current) return;
      if (phoneInFlightRef.current) return;
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;
      phoneInFlightRef.current = true;
      setPhoneUi((s) => ({
        ...s,
        status: phoneModelRef.current ? "ready" : "loading",
      }));
      try {
        const { FilesetResolver, ObjectDetector } = await import("@mediapipe/tasks-vision");

        if (!phoneModelRef.current) {
          phoneModelRef.current = await withMediapipeQuietAsync(async () => {
            const fileset = await FilesetResolver.forVisionTasks(
              MEDIAPIPE_VISION_WASM,
              false,
            );
            return ObjectDetector.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: PHONE_OD_MODEL_URL },
              runningMode: "VIDEO",
              scoreThreshold: PHONE_OD_SCORE_THRESHOLD,
              maxResults: 5,
            });
          });
        }
        const detector = phoneModelRef.current as {
          detectForVideo: (frame: HTMLVideoElement, ts: number) => { detections: Array<{ categories: Array<{ score: number; categoryName: string }>; boundingBox?: { originX: number; originY: number; width: number; height: number } }> };
        };
        phoneVideoTsRef.current = Math.max(phoneVideoTsRef.current + 1, nowMs);
        const { detections } = withMediapipeQuiet(() =>
          detector.detectForVideo(video, phoneVideoTsRef.current),
        );
        const picks: Array<{
          score: number;
          box: { originX: number; originY: number; width: number; height: number };
        }> = [];
        for (const d of detections) {
          const cat = d.categories[0];
          const box = d.boundingBox;
          if (!cat || !box) continue;
          if (!isPhoneObjectLabel(cat.categoryName)) continue;
          picks.push({ score: cat.score, box });
        }
        picks.sort((a, b) => b.score - a.score);

        const best = picks[0];
        const score = best?.score ?? 0;
        phoneScoreEmaRef.current =
          phoneScoreEmaRef.current * 0.55 + score * 0.45;

        const hits = phoneHitTimesRef.current.filter(
          (t) => nowMs - t <= PHONE_HITS_WINDOW_MS,
        );
        if (score >= PHONE_SCORE_THRESHOLD) hits.push(nowMs);
        phoneHitTimesRef.current = hits;
        const confirmed = hits.length >= PHONE_HITS_TO_TRIGGER;

        setPhoneUi((s) => ({
          ...s,
          status: confirmed ? "detected" : phoneModelRef.current ? "ready" : "loading",
          lastScore: score > 0 ? score : null,
        }));

        if (best && confirmed) {
          phoneDetectedUntilRef.current = nowMs + PHONE_HOLD_MS;
          const b = best.box;
          phoneBoxRef.current = {
            x: b.originX,
            y: b.originY,
            width: b.width,
            height: b.height,
            score,
          };
        } else {
          phoneBoxRef.current = null;
        }
        phoneFailCountRef.current = 0;
      } catch {
        phoneFailCountRef.current += 1;
        setPhoneUi((s) => ({ ...s, status: "error" }));
        if (phoneFailCountRef.current >= 5) {
          phoneDisabledRef.current = true;
          setPhoneUi((s) => ({ ...s, status: "disabled" }));
        }
      } finally {
        phoneInFlightRef.current = false;
      }
    },
    [],
  );

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const disposePhoneMl = useCallback(() => {
    phoneInFlightRef.current = false;
    const det = phoneModelRef.current as { close?: () => void } | null;
    phoneModelRef.current = null;
    try {
      det?.close?.();
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      disposePhoneMl();
      disposeFaceLandmarker();
      faceLandmarkerRef.current = null;
      stopStream();
      setModelsReady(false);
      setStatus("Camera off — use manual focus or enable in Settings.");
      clearHud(canvasRef.current);
      return;
    }
    let cancelled = false;
    (async () => {
      setError(null);
      setModelsReady(false);
      setStatus("Starting camera…");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            // 640×480 is sufficient for face landmark inference and
            // keeps CPU/memory well within low-spec laptop limits.
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 15, max: 24 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play();
        }
        setStatus("Loading vision models…");
        const landmarker = await getFaceLandmarker();
        if (cancelled) return;
        if (!landmarker) {
          throw new Error("Face Landmarker failed to load. Run npm run vendor:ml.");
        }
        faceLandmarkerRef.current = landmarker;

        if (!landmarkerPrimary) {
          const faceapi = await import("@vladmandic/face-api");
          const MODEL_URL = "/models";
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          ]);
        }

        if (cancelled) return;
        setModelsReady(true);
        setStatus("Tracking eyes, face & distractions");
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not access the camera.";
        setError(msg);
        setStatus("");
        setModelsReady(false);
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
      disposePhoneMl();
      disposeFaceLandmarker();
      faceLandmarkerRef.current = null;
    };
  }, [enabled, stopStream, disposePhoneMl]);

  useEffect(() => {
    if (!enabled || error || !modelsReady) return;

    // Single-flight guard: if the previous async tick is still running
    // (e.g. inference stalled > TICK_INTERVAL_MS on a slow CPU) skip this tick
    // entirely rather than queuing another concurrent inference.
    let tickInFlight = false;

    const tick = async () => {
      if (tickInFlight) return;
      tickInFlight = true;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || video.readyState < 2) { tickInFlight = false; return; }
      if (!active) {
        clearHud(canvas);
        tickInFlight = false;
        return;
      }

      try {
        const nowMs = Date.now();
        const landmarker = faceLandmarkerRef.current;
        if (!landmarker) return;

        faceVideoTsRef.current = Math.max(faceVideoTsRef.current + 1, nowMs);
        let mpFrame = detectFaceLandmarks(landmarker, video, faceVideoTsRef.current);
        if (mpFrame) {
          lastMpFrameRef.current = mpFrame;
          lastMpFrameAtRef.current = nowMs;
        } else if (
          lastMpFrameRef.current &&
          nowMs - lastMpFrameAtRef.current <= FACE_HOLD_MS
        ) {
          mpFrame = lastMpFrameRef.current;
        }

        const vw = video.videoWidth;
        const vh = video.videoHeight;

        let sharpNorm = lastSharpNormRef.current;
        if (
          mpFrame?.box &&
          vw &&
          vh &&
          nowMs - lastRoiQualityMsRef.current >= ROI_SHARPNESS_EVERY_MS
        ) {
          lastRoiQualityMsRef.current = nowMs;
          if (!roiQualityCanvasRef.current) {
            roiQualityCanvasRef.current = document.createElement("canvas");
          }
          const rawVar = laplacianVarianceFaceRoi(video, mpFrame.box, roiQualityCanvasRef.current);
          sharpNorm = normalizeSharpness(rawVar);
          lastSharpNormRef.current = sharpNorm;
        }

        let base: FocusFrameResult = {
          score: 0,
          state: "away",
          rawEar: 0,
          hasFace: false,
          eyesScore: 0,
          faceScore: 0,
          yaw: 0,
          pitch: 0,
        };

        let trackingConfidence = 1;
        let presenceQuality: number | undefined;
        let eyeReliabilityL = 1;
        let eyeReliabilityR = 1;
        let eyeLikelyClosed = false;
        let eyeBlinkShutL = 0;
        let eyeBlinkShutR = 0;

        if (mpFrame && vw && vh) {
          if (!eyeSharpnessCanvasRef.current) {
            eyeSharpnessCanvasRef.current = document.createElement("canvas");
          }
          const eyeSharpL = eyeRegionSharpness(
            video,
            mpFrame.landmarks,
            MP_LEFT_EYE_EAR,
            eyeSharpnessCanvasRef.current,
          );
          const eyeSharpR = eyeRegionSharpness(
            video,
            mpFrame.landmarks,
            MP_RIGHT_EYE_EAR,
            eyeSharpnessCanvasRef.current,
          );

          const posePreview = poseFromTransformMatrix(mpFrame.transformMatrix);
          const poseStability =
            lastYawRef.current == null
              ? 0.85
              : Math.max(0.35, 1 - Math.abs(posePreview.yaw - lastYawRef.current) * 2.2);
          lastYawRef.current = posePreview.yaw;

          const presence = computeFacePresenceSignals(
            mpFrame.detectionConfidence,
            mpFrame.box,
            vw,
            vh,
            sharpNorm,
            {
              landmarks: mpFrame.landmarks,
              poseStability,
              blendshapeBlinkL: mpFrame.blendshapes.eyeBlinkLeft ?? 0,
              blendshapeBlinkR: mpFrame.blendshapes.eyeBlinkRight ?? 0,
              eyeSharpnessL: eyeSharpL,
              eyeSharpnessR: eyeSharpR,
            },
          );
          trackingConfidence =
            trackingConfidenceEmaRef.current * 0.55 + presence.trackingConfidence * 0.45;
          trackingConfidenceEmaRef.current = trackingConfidence;
          presenceQuality = presence.presenceQuality;
          eyeReliabilityL = presence.eyeReliabilityL;
          eyeReliabilityR = presence.eyeReliabilityR;

          const preSignals = extractFaceSignals({
            landmarks: mpFrame.landmarks,
            blendshapes: mpFrame.blendshapes,
            transformMatrix: mpFrame.transformMatrix,
            presence,
            videoWidth: vw,
            videoHeight: vh,
          });

          const smoothed = metricsSmootherRef.current.push(
            {
              ear: preSignals.ear,
              earL: preSignals.earL,
              earR: preSignals.earR,
              blinkOpen: preSignals.eyeBlinkAssist,
              yaw: preSignals.yaw,
              pitch: preSignals.pitch,
            },
            trackingConfidence,
          );

          const signals = extractFaceSignals(
            {
              landmarks: mpFrame.landmarks,
              blendshapes: mpFrame.blendshapes,
              transformMatrix: mpFrame.transformMatrix,
              presence,
              videoWidth: vw,
              videoHeight: vh,
            },
            { smoothed },
          );
          eyeLikelyClosed = signals.eyeLikelyClosed;
          eyeBlinkShutL = signals.eyeBlinkShutL;
          eyeBlinkShutR = signals.eyeBlinkShutR;

          base = scoreFocusFromFaceSignals(signals, {
            focusThreshold,
            distractionThreshold,
            prevSmoothed: smoothedRef.current,
            smoothAlpha: 0.28,
            trackingConfidence,
            presenceQuality,
          });
          base.eyeReliabilityL = eyeReliabilityL;
          base.eyeReliabilityR = eyeReliabilityR;

          if (canvas && video) {
            drawLandmarkerHud(canvas, video, mpFrame, phoneBoxRef.current);
          }
          const nextMode = base.signalMode ?? "full";
          // Only trigger a React re-render when the mode label actually changes.
          setSignalModeUi((prev) => (prev === nextMode ? prev : nextMode));
        } else {
          lastSharpNormRef.current = 0.55;
          clearHud(canvas);
          setSignalModeUi((prev) => (prev === "full" ? prev : "full"));
        }

        // Dev parity: compare MediaPipe vs face-api when legacy flag is on.
        if (!landmarkerPrimary && mpFrame && nowMs - lastParityLogAtRef.current >= PARITY_LOG_EVERY_MS) {
          lastParityLogAtRef.current = nowMs;
          try {
            const faceapi = await import("@vladmandic/face-api");
            const tinyOpts = new faceapi.TinyFaceDetectorOptions({
              inputSize: 416,
              scoreThreshold: 0.36,
            });
            let det =
              await faceapi
                .detectSingleFace(video, tinyOpts)
                .withFaceLandmarks()
                .withFaceExpressions();
            if (!det) {
              det = await faceapi
                .detectSingleFace(
                  video,
                  new faceapi.SsdMobilenetv1Options({
                    minConfidence: SSD_MIN_CONFIDENCE,
                    maxResults: 1,
                  }),
                )
                .withFaceLandmarks()
                .withFaceExpressions();
            }
            if (det) {
              const legacy = scoreFocusFromLandmarks(
                det.landmarks as unknown as Landmark68,
                expressionsToRecord(det.expressions),
                {
                  focusThreshold,
                  distractionThreshold,
                  prevSmoothed: null,
                  smoothAlpha: 0.28,
                  trackingConfidence,
                },
              );
              if (process.env.NODE_ENV === "development") {
                console.debug("[focus-parity]", {
                  earMp: base.rawEar.toFixed(3),
                  earFa: legacy.rawEar.toFixed(3),
                  yawMp: base.yaw.toFixed(3),
                  yawFa: legacy.yaw.toFixed(3),
                  pitchMp: base.pitch.toFixed(3),
                  pitchFa: legacy.pitch.toFixed(3),
                });
              }
              base = legacy;
            }
          } catch {
            /* parity logging is best-effort */
          }
        }

        if (base.hasFace) {
          smoothedRef.current = base.score;
          lastFaceAtRef.current = Date.now();
        }

        const awayFor = Date.now() - lastFaceAtRef.current;

        if (
          base.hasFace &&
          phoneDetectionEnabled &&
          !phoneDisabledRef.current &&
          nowMs - lastPhoneTickAtRef.current >= PHONE_DETECT_EVERY_MS
        ) {
          lastPhoneTickAtRef.current = nowMs;
          void runPhoneDetection(video, nowMs).catch(() => {});
        }

        const phoneDetected =
          phoneDetectionEnabled && nowMs <= phoneDetectedUntilRef.current;

        const hasTrackedFace = base.hasFace && awayFor <= AWAY_MS;

        const out: AttentionFrameResult = engineRef.current.update({
          nowMs,
          hasFace: hasTrackedFace,
          ear: base.rawEar,
          earL: hasTrackedFace ? base.earL : undefined,
          earR: hasTrackedFace ? base.earR : undefined,
          eyeLikelyClosed: hasTrackedFace ? eyeLikelyClosed : undefined,
          eyeBlinkAssist: hasTrackedFace ? base.eyeBlinkAssist : null,
          eyeBlinkShutL: hasTrackedFace ? eyeBlinkShutL : undefined,
          eyeBlinkShutR: hasTrackedFace ? eyeBlinkShutR : undefined,
          eyeReliabilityL: hasTrackedFace ? eyeReliabilityL : undefined,
          eyeReliabilityR: hasTrackedFace ? eyeReliabilityR : undefined,
          signalMode: base.signalMode,
          deskWorkBias,
          focusSensitivity,
          eyesScore: base.eyesScore,
          faceScore: base.faceScore,
          yaw: base.yaw,
          pitch: base.pitch,
          phoneDetected,
          trackingConfidence: hasTrackedFace ? trackingConfidence : undefined,
        });

        if (!base.hasFace && awayFor > AWAY_MS) {
          clearHud(canvas);
        }

        const compat: FocusFrameResult & {
          flags?: AttentionFrameResult["flags"];
          durations?: AttentionFrameResult["durations"];
        } = {
          score: out.score,
          state: out.state,
          rawEar: out.rawEar,
          hasFace: out.hasFace,
          eyesScore: out.eyesScore,
          faceScore: out.faceScore,
          yaw: out.yaw,
          pitch: out.pitch,
          flags: out.flags,
          durations: out.durations,
          trackingConfidence: base.trackingConfidence,
          presenceQuality: base.presenceQuality,
          signalMode: base.signalMode,
          earL: base.earL,
          earR: base.earR,
          eyeReliabilityL: base.eyeReliabilityL,
          eyeReliabilityR: base.eyeReliabilityR,
          eyeBlinkAssist: base.eyeBlinkAssist,
        };

        onSampleRef.current(compat);
      } catch {
        clearHud(canvasRef.current);
        const s = Math.round(smoothedRef.current ?? 30);
        onSampleRef.current({
          score: s,
          state: "drifting",
          rawEar: 0,
          hasFace: false,
          eyesScore: s,
          faceScore: s,
          yaw: 0,
          pitch: 0,
        });
      } finally {
        tickInFlight = false;
      }
    };

    const id = window.setInterval(() => {
      void tick();
    }, TICK_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- latest node on unmount
      clearHud(canvasRef.current);
    };
  }, [
    enabled,
    active,
    phoneDetectionEnabled,
    error,
    modelsReady,
    focusThreshold,
    distractionThreshold,
    focusSensitivity,
    deskWorkBias,
    runPhoneDetection,
  ]);

  const limitedLabel = signalModeLabel(signalModeUi);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        />
        {!enabled ? (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/85 p-4 text-center text-sm text-zinc-300">
            Webcam disabled in Settings.
          </div>
        ) : null}
        {enabled && modelsReady && !error ? (
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
              Live track
            </span>
            <span
              className={
                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider " +
                (!phoneDetectionEnabled || phoneDisabledRef.current
                  ? "bg-white/10 text-zinc-200"
                  : Date.now() <= phoneDetectedUntilRef.current
                    ? "bg-red-500/80 text-white"
                    : "bg-white/10 text-zinc-200")
              }
            >
              {!phoneDetectionEnabled
                ? "Phone Detection off"
                : phoneDisabledRef.current
                  ? "Phone Detection off"
                  : Date.now() <= phoneDetectedUntilRef.current
                    ? "Phone detected"
                    : "Phone Detection on"}
            </span>
            {limitedLabel ? (
              <span className="rounded-full bg-amber-500/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-100">
                {limitedLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        className={
          variant === "glass"
            ? "library-glass-footer"
            : "border-t border-slate-200/90 bg-slate-100 px-3 py-2.5 text-xs text-slate-600 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-400"
        }
      >
        {error ? (
          <span className="text-alert">{error}</span>
        ) : (
          <span>
            {status}
            {!phoneDisabledRef.current && phoneUi.lastScore != null ? (
              <span className="ml-2 text-[10px] text-slate-500">
                Phone conf: {(phoneUi.lastScore * 100).toFixed(0)}%
              </span>
            ) : null}
          </span>
        )}
      </div>
    </div>
  );
}
