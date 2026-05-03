"use client";

import {
  scoreFocusFromLandmarks,
  type Landmark68,
} from "@/lib/focus-detection";
import type { FocusFrameResult } from "@/lib/focus-detection";
import type { FocusSampleState } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  enabled: boolean;
  active: boolean;
  focusThreshold: number;
  distractionThreshold: number;
  manualScore: number | null;
  onSample: (sample: FocusFrameResult) => void;
};

const AWAY_MS = 5000;

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

export function FocusCamera({
  enabled,
  active,
  focusThreshold,
  distractionThreshold,
  manualScore,
  onSample,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const smoothedRef = useRef<number | null>(null);
  const lastFaceAtRef = useRef<number>(Date.now());
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const onSampleRef = useRef(onSample);

  /** Reset away-timer when monitoring starts, or "away" fires immediately (clock was set at mount). */
  useEffect(() => {
    if (enabled && modelsReady && active && manualScore === null) {
      lastFaceAtRef.current = Date.now();
      smoothedRef.current = null;
    }
  }, [enabled, modelsReady, active, manualScore]);
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
        setStatus("Camera ready");
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
      if (!video || video.readyState < 2) return;
      if (!active) return;

      if (manualScore !== null) {
        const state: FocusSampleState =
          manualScore >= focusThreshold
            ? "focused"
            : manualScore < distractionThreshold
              ? "distracted"
              : "drifting";
        onSampleRef.current({
          score: manualScore,
          state,
          rawEar: 0,
          hasFace: true,
        });
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

        if (base.hasFace) {
          smoothedRef.current = base.score;
          lastFaceAtRef.current = Date.now();
        }

        const awayFor = Date.now() - lastFaceAtRef.current;
        let out: FocusFrameResult = base;
        if (!base.hasFace && awayFor > AWAY_MS) {
          smoothedRef.current = 0;
          out = {
            score: 0,
            state: "away",
            rawEar: base.rawEar,
            hasFace: false,
          };
        } else if (!base.hasFace && awayFor <= AWAY_MS) {
          out = {
            score: Math.round(smoothedRef.current ?? 35),
            state: "drifting",
            rawEar: 0,
            hasFace: false,
          };
        }

        onSampleRef.current(out);
      } catch {
        // Transient tensor / WebGL errors should not look like "stepped away"
        onSampleRef.current({
          score: Math.round(smoothedRef.current ?? 30),
          state: "drifting",
          rawEar: 0,
          hasFace: false,
        });
      }
    };

    const id = window.setInterval(() => {
      void tick();
    }, 480);
    return () => clearInterval(id);
  }, [
    enabled,
    active,
    error,
    modelsReady,
    focusThreshold,
    distractionThreshold,
    manualScore,
  ]);

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/10 bg-surface shadow-sm">
      <div className="relative aspect-video w-full bg-primary-soft/40">
        <video
          ref={videoRef}
          className="h-full w-full object-cover opacity-90"
          playsInline
          muted
        />
        {!enabled ? (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/80 p-4 text-center text-sm text-muted">
            Webcam disabled in Settings.
          </div>
        ) : null}
      </div>
      <div className="border-t border-primary/10 px-3 py-2 text-xs text-muted">
        {error ? (
          <span className="text-alert">{error}</span>
        ) : (
          <span>{status}</span>
        )}
      </div>
    </div>
  );
}
