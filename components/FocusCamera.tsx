"use client";

import {
  scoreFocusFromLandmarks,
  type Landmark68,
} from "@/lib/focus-detection";
import type { FocusFrameResult } from "@/lib/focus-detection";
import {
  FocusAttentionEngine,
  type AttentionFrameResult,
} from "@/lib/focus-attention-engine";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  enabled: boolean;
  active: boolean;
  phoneDetectionEnabled?: boolean;
  focusThreshold: number;
  distractionThreshold: number;
  onSample: (sample: FocusFrameResult) => void;
};

const AWAY_MS = 5000;
const PHONE_DETECT_EVERY_MS = 1100;
const EYE_DETECT_EVERY_MS = 280;
const EYE_MODEL_URL = "/models/eyeblink/model.json";
const PHONE_HOLD_MS = 3500;
const PHONE_SCORE_THRESHOLD = 0.25;
const PHONE_HITS_WINDOW_MS = 2500;
const PHONE_HITS_TO_TRIGGER = 2;

const LEFT_EYE_I = [36, 37, 38, 39, 40, 41] as const;
const RIGHT_EYE_I = [42, 43, 44, 45, 46, 47] as const;

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

/** Map a point in video pixel space to the element box when video uses object-cover */
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

function drawFaceHud(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  det: {
    detection: { box: { x: number; y: number; width: number; height: number } };
    landmarks: { positions: { x: number; y: number }[] };
  },
  phoneBox?: { x: number; y: number; width: number; height: number; score?: number } | null,
) {
  const wrap = canvas.parentElement;
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const box = det.detection.box;
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

  const pos = det.landmarks.positions;
  if (!pos?.length) return;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const vr = vw / vh;
  const er = w / h;
  const coverScale = vr > er ? h / vh : w / vw;

  const eyeRadius = (idxs: readonly number[]) => {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const i of idxs) {
      const p = pos[i];
      if (p) {
        sx += p.x;
        sy += p.y;
        n++;
      }
    }
    if (!n) return null;
    const cx = sx / n;
    const cy = sy / n;
    const p36 = pos[36];
    const p39 = pos[39];
    const eyeW =
      p36 && p39 ? Math.hypot(p39.x - p36.x, p39.y - p36.y) : 28;
    const r = Math.max(7, eyeW * 0.36 * coverScale);
    const c = mapVideoPointToCover(video, w, h, cx, cy);
    return { ...c, r };
  };

  const le = eyeRadius(LEFT_EYE_I);
  const re = eyeRadius(RIGHT_EYE_I);
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

export function FocusCamera({
  enabled,
  active,
  phoneDetectionEnabled = true,
  focusThreshold,
  distractionThreshold,
  onSample,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const smoothedRef = useRef<number | null>(null);
  const lastFaceAtRef = useRef<number>(Date.now());
  const engineRef = useRef<FocusAttentionEngine>(new FocusAttentionEngine());
  const lastPhoneTickAtRef = useRef<number>(0);
  const phoneDetectedUntilRef = useRef<number>(0);
  const phoneModelRef = useRef<unknown>(null);
  const phoneInFlightRef = useRef<boolean>(false);
  const phoneFailCountRef = useRef<number>(0);
  const phoneDisabledRef = useRef<boolean>(false);
  const eyeModelRef = useRef<Awaited<
    ReturnType<typeof import("@tensorflow/tfjs").loadGraphModel>
  > | null>(null);
  const eyeScratchRef = useRef<HTMLCanvasElement | null>(null);
  const eyeOpennessCachedRef = useRef<number | null>(null);
  const lastEyeInferAtRef = useRef<number>(0);
  const eyeInFlightRef = useRef<boolean>(false);
  const eyeFailCountRef = useRef<number>(0);
  const eyeDisabledRef = useRef<boolean>(false);

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
  const [eyeUi, setEyeUi] = useState<{
    status: "idle" | "loading" | "ready" | "error" | "disabled";
    lastOpenness: number | null;
  }>({ status: "idle", lastOpenness: null });
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
      phoneBoxRef.current = null;
      eyeOpennessCachedRef.current = null;
      lastEyeInferAtRef.current = 0;
      eyeInFlightRef.current = false;
      eyeFailCountRef.current = 0;
      eyeDisabledRef.current = false;
      setPhoneUi({ enabled: true, status: "idle", lastScore: null });
      setEyeUi({ status: "idle", lastOpenness: null });
    }
  }, [enabled, modelsReady, active]);
  onSampleRef.current = onSample;

  const runPhoneDetection = useCallback(
    async (video: HTMLVideoElement, nowMs: number) => {
      if (phoneDisabledRef.current) return;
      if (phoneInFlightRef.current) return;
      phoneInFlightRef.current = true;
      setPhoneUi((s) => ({
        ...s,
        status: phoneModelRef.current ? "ready" : "loading",
      }));
      try {
        // Keep ALL failures contained: never let phone detection crash the main loop.
        const tf = await import("@tensorflow/tfjs");
        await import("@tensorflow/tfjs-backend-webgl");
        try {
          if (tf.getBackend() !== "webgl") await tf.setBackend("webgl");
          await tf.ready();
        } catch {
          // backend init failed; just skip this pass
          return;
        }

        const cocoMod = await import("@tensorflow-models/coco-ssd");
        const cocoAny = cocoMod as unknown as {
          load?: (opts?: unknown) => Promise<unknown>;
          default?: { load?: (opts?: unknown) => Promise<unknown> };
        };
        const loadFn = cocoAny.load ?? cocoAny.default?.load;
        if (typeof loadFn !== "function") throw new Error("COCO-SSD load missing");

        if (!phoneModelRef.current) {
          // Prefer accuracy over speed; phone is a small object and often low-confidence.
          // (Falls back if option is unsupported in this build.)
          try {
            phoneModelRef.current = await loadFn({ base: "mobilenet_v2" });
          } catch {
            phoneModelRef.current = await loadFn();
          }
        }
        const model = phoneModelRef.current as unknown as {
          detect: (input: HTMLVideoElement) => Promise<
            Array<{ class: string; score?: number; bbox?: [number, number, number, number] }>
          >;
        };
        const preds = await model.detect(video);
        const phones = preds
          .filter((p) => p.class === "cell phone")
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const best = phones[0];

        const score = best?.score ?? 0;
        // EMA smooths confidence, reduces flicker.
        phoneScoreEmaRef.current =
          phoneScoreEmaRef.current * 0.55 + score * 0.45;

        // Temporal confirmation: require multiple hits within a short window.
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
          const bb = best.bbox;
          if (bb) {
            phoneBoxRef.current = { x: bb[0], y: bb[1], width: bb[2], height: bb[3], score };
          }
        } else {
          phoneBoxRef.current = null;
        }
        phoneFailCountRef.current = 0;
      } catch {
        phoneFailCountRef.current += 1;
        setPhoneUi((s) => ({ ...s, status: "error" }));
        // Backoff and eventually disable if it keeps failing.
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

  const runEyeOpenness = useCallback(
    async (
      video: HTMLVideoElement,
      landmarks: { positions: { x: number; y: number }[] },
    ) => {
      if (eyeDisabledRef.current) return;
      if (!eyeScratchRef.current && typeof document !== "undefined") {
        eyeScratchRef.current = document.createElement("canvas");
      }
      const canvas = eyeScratchRef.current;
      if (!canvas) return;

      setEyeUi((s) => ({
        ...s,
        status: eyeModelRef.current ? "ready" : "loading",
      }));

      try {
        const tf = await import("@tensorflow/tfjs");
        await import("@tensorflow/tfjs-backend-webgl");
        try {
          if (tf.getBackend() !== "webgl") await tf.setBackend("webgl");
          await tf.ready();
        } catch {
          await tf.ready();
        }

        if (!eyeModelRef.current) {
          eyeModelRef.current = await tf.loadGraphModel(EYE_MODEL_URL);
        }
        const model = eyeModelRef.current;

        const pos = landmarks.positions;
        const pts = [...LEFT_EYE_I, ...RIGHT_EYE_I]
          .map((i) => pos[i])
          .filter(Boolean) as { x: number; y: number }[];
        if (!pts.length) return;

        let minX = pts[0]!.x;
        let maxX = pts[0]!.x;
        let minY = pts[0]!.y;
        let maxY = pts[0]!.y;
        for (const p of pts) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
        const padX = (maxX - minX) * 0.38;
        const padY = (maxY - minY) * 0.52;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return;

        let sx = Math.floor(minX - padX);
        let sy = Math.floor(minY - padY);
        let sw = Math.ceil(maxX - minX + 2 * padX);
        let sh = Math.ceil(maxY - minY + 2 * padY);
        sx = Math.max(0, Math.min(vw - 1, sx));
        sy = Math.max(0, Math.min(vh - 1, sy));
        sw = Math.max(1, Math.min(vw - sx, sw));
        sh = Math.max(1, Math.min(vh - sy, sh));
        if (sw < 10 || sh < 10) return;

        canvas.width = 34;
        canvas.height = 26;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 34, 26);

        let out: number | null = null;
        tf.tidy(() => {
          const img = tf.browser.fromPixels(canvas, 1).toFloat().div(255);
          const batched = img.expandDims(0);
          const y = model.predict(batched) as import("@tensorflow/tfjs").Tensor;
          const v = y.dataSync()[0];
          if (typeof v === "number" && Number.isFinite(v)) {
            out = Math.max(0, Math.min(1, v));
          }
        });

        if (out != null) {
          eyeOpennessCachedRef.current = out;
          eyeFailCountRef.current = 0;
          setEyeUi({ status: "ready", lastOpenness: out });
        }
      } catch {
        eyeFailCountRef.current += 1;
        setEyeUi((s) => ({ ...s, status: "error" }));
        if (eyeFailCountRef.current >= 5) {
          eyeDisabledRef.current = true;
          setEyeUi((s) => ({ ...s, status: "disabled" }));
        }
      } finally {
        eyeInFlightRef.current = false;
      }
    },
    [],
  );

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
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
          video: { facingMode: "user", width: 640, height: 480 },
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
        const faceapi = await import("@vladmandic/face-api");
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
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
    };
  }, [enabled, stopStream]);

  useEffect(() => {
    if (!enabled || error || !modelsReady) return;

    const tick = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || video.readyState < 2) return;
      if (!active) {
        clearHud(canvas);
        return;
      }

      try {
        const faceapi = await import("@vladmandic/face-api");
        const det = await faceapi
          .detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 416,
              scoreThreshold: 0.32,
            }),
          )
          .withFaceLandmarks()
          .withFaceExpressions();

        const expressions = expressionsToRecord(det?.expressions);
        const landmarks = det?.landmarks;

        const base = scoreFocusFromLandmarks(
          landmarks as unknown as Landmark68 | undefined,
          expressions,
          {
            focusThreshold,
            distractionThreshold,
            prevSmoothed: smoothedRef.current,
            smoothAlpha: 0.28,
          },
        );

        if (det && canvas && video) {
          drawFaceHud(
            canvas,
            video,
            det as {
              detection: {
                box: { x: number; y: number; width: number; height: number };
              };
              landmarks: { positions: { x: number; y: number }[] };
            },
            phoneBoxRef.current,
          );
        } else {
          clearHud(canvas);
        }

        if (base.hasFace) {
          smoothedRef.current = base.score;
          lastFaceAtRef.current = Date.now();
        } else {
          eyeOpennessCachedRef.current = null;
        }

        const awayFor = Date.now() - lastFaceAtRef.current;
        const nowMs = Date.now();

        // Low-cadence phone detection (COCO-SSD). If detected, hold flag for a few seconds.
        if (
          base.hasFace &&
          phoneDetectionEnabled &&
          !phoneDisabledRef.current &&
          nowMs - lastPhoneTickAtRef.current >= PHONE_DETECT_EVERY_MS
        ) {
          lastPhoneTickAtRef.current = nowMs;
          // Extra safety: ensure any unexpected rejection is swallowed.
          void runPhoneDetection(video, nowMs).catch(() => {});
        }

        const phoneDetected =
          phoneDetectionEnabled && nowMs <= phoneDetectedUntilRef.current;

        const hasTrackedFace = base.hasFace && awayFor <= AWAY_MS;
        if (
          hasTrackedFace &&
          landmarks &&
          !eyeDisabledRef.current &&
          nowMs - lastEyeInferAtRef.current >= EYE_DETECT_EVERY_MS &&
          !eyeInFlightRef.current
        ) {
          lastEyeInferAtRef.current = nowMs;
          eyeInFlightRef.current = true;
          void runEyeOpenness(video, landmarks).catch(() => {
            eyeInFlightRef.current = false;
          });
        }

        // Feed the attention engine (stateful; handles gating + realistic dynamics)
        const out: AttentionFrameResult = engineRef.current.update({
          nowMs,
          hasFace: hasTrackedFace,
          ear: base.rawEar,
          eyeOpennessMl: hasTrackedFace ? eyeOpennessCachedRef.current : null,
          eyesScore: base.eyesScore,
          faceScore: base.faceScore,
          yaw: base.yaw,
          pitch: base.pitch,
          phoneDetected,
        });

        if (!base.hasFace && awayFor > AWAY_MS) {
          clearHud(canvas);
        }

        // Backwards-compatible shape: keep existing FocusFrameResult fields, add optional flags.
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
      }
    };

    const id = window.setInterval(() => {
      void tick();
    }, 240);
    return () => {
      window.clearInterval(id);
      // Intentionally read ref at teardown so we clear the mounted canvas
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
    runPhoneDetection,
    runEyeOpenness,
  ]);

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
            <span
              className={
                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider " +
                (eyeDisabledRef.current
                  ? "bg-white/10 text-zinc-200"
                  : eyeUi.status === "loading"
                    ? "bg-amber-500/50 text-white"
                    : eyeUi.status === "error"
                      ? "bg-amber-900/55 text-amber-100"
                      : "bg-white/10 text-zinc-200")
              }
            >
              {eyeDisabledRef.current
                ? "Eye model off"
                : eyeUi.status === "loading"
                  ? "Eye model loading"
                  : eyeUi.status === "error"
                    ? "Eye model error"
                    : "Eye model on"}
            </span>
          </div>
        ) : null}
      </div>
      <div className="border-t border-slate-200/90 bg-slate-100 px-3 py-2.5 text-xs text-slate-600 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-400">
        {error ? (
          <span className="text-alert">{error}</span>
        ) : (
          <span>
            {status}
            {!phoneDisabledRef.current && phoneUi.lastScore != null ? (
              <span className="ml-2 text-[10px] text-slate-500 dark:text-zinc-500">
                Phone conf: {(phoneUi.lastScore * 100).toFixed(0)}%
              </span>
            ) : null}
          </span>
        )}
      </div>
    </div>
  );
}
