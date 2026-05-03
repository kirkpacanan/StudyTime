"use client";

import {
  scoreFocusFromLandmarks,
  type Landmark68,
} from "@/lib/focus-detection";
import type { FocusFrameResult } from "@/lib/focus-detection";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  enabled: boolean;
  active: boolean;
  focusThreshold: number;
  distractionThreshold: number;
  onSample: (sample: FocusFrameResult) => void;
};

const AWAY_MS = 5000;

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
  focusThreshold,
  distractionThreshold,
  onSample,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const smoothedRef = useRef<number | null>(null);
  const lastFaceAtRef = useRef<number>(Date.now());
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const onSampleRef = useRef(onSample);

  useEffect(() => {
    if (enabled && modelsReady && active) {
      lastFaceAtRef.current = Date.now();
      smoothedRef.current = null;
    }
  }, [enabled, modelsReady, active]);
  onSampleRef.current = onSample;

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
        const faceapi = await import("face-api.js");
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        if (cancelled) return;
        setModelsReady(true);
        setStatus("Tracking eyes & face");
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
        const faceapi = await import("face-api.js");
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
          );
        } else {
          clearHud(canvas);
        }

        if (base.hasFace) {
          smoothedRef.current = base.score;
          lastFaceAtRef.current = Date.now();
        }

        const awayFor = Date.now() - lastFaceAtRef.current;
        let out: FocusFrameResult = base;
        if (!base.hasFace && awayFor > AWAY_MS) {
          smoothedRef.current = 0;
          clearHud(canvas);
          out = {
            score: 0,
            state: "away",
            rawEar: base.rawEar,
            hasFace: false,
            eyesScore: 0,
            faceScore: 0,
          };
        } else if (!base.hasFace && awayFor <= AWAY_MS) {
          clearHud(canvas);
          out = {
            score: Math.round(smoothedRef.current ?? 35),
            state: "drifting",
            rawEar: 0,
            hasFace: false,
            eyesScore: 0,
            faceScore: 0,
          };
        }

        onSampleRef.current(out);
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
        });
      }
    };

    const id = window.setInterval(() => {
      void tick();
    }, 480);
    return () => {
      window.clearInterval(id);
      // Intentionally read ref at teardown so we clear the mounted canvas
      // eslint-disable-next-line react-hooks/exhaustive-deps -- latest node on unmount
      clearHud(canvasRef.current);
    };
  }, [
    enabled,
    active,
    error,
    modelsReady,
    focusThreshold,
    distractionThreshold,
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
          </div>
        ) : null}
      </div>
      <div className="border-t border-slate-200/90 bg-slate-100 px-3 py-2.5 text-xs text-slate-600 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-400">
        {error ? (
          <span className="text-alert">{error}</span>
        ) : (
          <span>{status}</span>
        )}
      </div>
    </div>
  );
}
