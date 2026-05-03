"use client";

import { PageTransition } from "@/components/PageTransition";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

type TrailPt = { x: number; y: number; t: number };

function sketchWobble(i: number, now: number) {
  return (
    Math.sin(i * 2.17 + now * 0.0028) * 2.1 +
    Math.cos(i * 1.31 - now * 0.0019) * 1.4 +
    Math.sin(i * 0.71 + now * 0.004) * 0.9
  );
}

export function AuthScenery({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<TrailPt[]>([]);
  const rafRef = useRef(0);
  const darkRef = useRef(false);
  const loopActiveRef = useRef(false);
  const scribbleDownRef = useRef(false);

  useEffect(() => {
    if (reduce === true) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const readDark = () =>
      document.documentElement.classList.contains("dark");
    darkRef.current = readDark();
    const mo = new MutationObserver(() => {
      darkRef.current = readDark();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const MAX_AGE_MS = 2600;
    const MAX_POINTS = 420;
    const MIN_DIST = 1.4;

    const startLoop = () => {
      if (loopActiveRef.current) return;
      loopActiveRef.current = true;
      const tick = (now: number) => {
        const trail = trailRef.current;
        const w = window.innerWidth;
        const h = window.innerHeight;

        while (trail.length > 0 && now - trail[0].t > MAX_AGE_MS) {
          trail.shift();
        }

        ctx.clearRect(0, 0, w, h);

        if (trail.length < 2) {
          loopActiveRef.current = false;
          return;
        }

        const dark = darkRef.current;

        for (let i = 1; i < trail.length; i++) {
          const p0 = trail[i - 1]!;
          const p1 = trail[i]!;
          const age = now - p1.t;
          const life = Math.max(0, 1 - age / MAX_AGE_MS);
          if (life < 0.04) continue;

          const wb0 = sketchWobble(i - 1, now);
          const wb1 = sketchWobble(i, now);
          const pressure = 0.75 + Math.sin(i * 0.9 + now * 0.005) * 0.35;
          const alpha = 0.07 + life * 0.48 * pressure;
          const lw = 0.85 + life * 3.4 * pressure;

          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.globalAlpha = alpha;
          ctx.lineWidth = lw;

          if (dark) {
            ctx.strokeStyle = `rgba(200, 245, 255, ${0.25 + life * 0.55})`;
            ctx.shadowBlur = 5 + life * 10;
            ctx.shadowColor = "rgba(34, 211, 238, 0.5)";
          } else {
            ctx.strokeStyle = `rgba(35, 52, 105, ${0.22 + life * 0.52})`;
            ctx.shadowBlur = 3 + life * 7;
            ctx.shadowColor = "rgba(79, 134, 247, 0.4)";
          }

          ctx.beginPath();
          ctx.moveTo(p0.x + wb0 * 0.55, p0.y - wb0 * 0.35);
          ctx.lineTo(p1.x + wb1 * 0.55, p1.y - wb1 * 0.35);
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const addTrailPoint = (e: PointerEvent) => {
      const trail = trailRef.current;
      const t = performance.now();
      const jitter = 2.6;
      const nx =
        e.clientX +
        (Math.random() - 0.5) * jitter +
        sketchWobble(trail.length, t) * 0.35;
      const ny =
        e.clientY +
        (Math.random() - 0.5) * jitter -
        sketchWobble(trail.length + 2, t) * 0.35;

      const last = trail[trail.length - 1];
      if (last) {
        const d = Math.hypot(nx - last.x, ny - last.y);
        if (d < MIN_DIST) return;
      }

      trail.push({ x: nx, y: ny, t });
      if (trail.length > MAX_POINTS) {
        trail.splice(0, trail.length - MAX_POINTS);
      }
      startLoop();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      scribbleDownRef.current = true;
      addTrailPoint(e);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!scribbleDownRef.current) return;
      addTrailPoint(e);
    };

    const endScribbleStroke = () => {
      scribbleDownRef.current = false;
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", endScribbleStroke);
    window.addEventListener("pointercancel", endScribbleStroke);
    window.addEventListener("blur", endScribbleStroke);

    return () => {
      mo.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endScribbleStroke);
      window.removeEventListener("pointercancel", endScribbleStroke);
      window.removeEventListener("blur", endScribbleStroke);
      cancelAnimationFrame(rafRef.current);
      loopActiveRef.current = false;
      scribbleDownRef.current = false;
      trailRef.current = [];
    };
  }, [reduce]);

  return (
    <div className="relative isolate min-h-screen bg-gradient-to-br from-bg via-primary-soft/30 to-bg dark:from-[#050810] dark:via-slate-950 dark:to-[#0a1020]">
      {/* Clip only decorative layers so burst icons (portal target below) are not clipped mid-flight */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(79,134,247,0.22),transparent_55%)] dark:bg-[radial-gradient(ellipse_100%_70%_at_50%_-10%,rgba(34,211,238,0.12),transparent_50%)]" />

        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage: `linear-gradient(var(--auth-grid-major-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--auth-grid-major-line) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `linear-gradient(var(--auth-grid-minor-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--auth-grid-minor-line) 1px, transparent 1px)`,
            backgroundSize: "13px 13px",
          }}
        />

        {!reduce && (
          <>
            <motion.div
              className="dark:hidden pointer-events-none absolute left-1/2 h-0.5 w-[min(72%,680px)] max-w-[680px] -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,transparent_0%,transparent_10%,rgb(79,134,247)_50%,transparent_90%,transparent_100%)]"
              initial={{ top: "11%" }}
              animate={{
                top: ["11%", "89%", "11%"],
                opacity: [0.55, 1, 0.55],
              }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="hidden dark:block pointer-events-none absolute left-1/2 h-0.5 w-[min(72%,680px)] max-w-[680px] -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,transparent_0%,transparent_9%,rgb(103,232,249)_48%,rgb(165,243,252)_50%,rgb(103,232,249)_52%,transparent_91%,transparent_100%)]"
              initial={{ top: "11%" }}
              animate={{
                top: ["11%", "89%", "11%"],
                opacity: [0.45, 0.98, 0.45],
              }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}

        {!reduce && (
          <>
            <motion.div
              className="absolute -left-28 top-1/4 h-80 w-80 rounded-full bg-gradient-to-br from-primary/70 via-sky-400/50 to-blue-500/40 blur-3xl dark:from-cyan-400/22 dark:via-sky-500/14 dark:to-indigo-950/35"
              animate={{
                x: [0, 220, -80, 320, 40, -140, 0],
                y: [0, 90, 200, -40, -120, 60, 0],
                scale: [1, 1.12, 0.94, 1.1, 0.98, 1.06, 1],
                rotate: [0, 14, -8, 22, -12, 6, 0],
              }}
              transition={{
                duration: 32,
                repeat: Infinity,
                ease: "easeInOut",
                times: [0, 0.18, 0.36, 0.52, 0.68, 0.86, 1],
              }}
            />
            <motion.div
              className="absolute -right-24 bottom-1/4 h-96 w-96 rounded-full bg-gradient-to-tl from-emerald-400/60 via-teal-400/45 to-cyan-500/40 blur-3xl dark:from-indigo-500/26 dark:via-violet-600/16 dark:to-slate-950/40"
              animate={{
                x: [0, -260, 60, -180, 120, -40, 0],
                y: [0, -100, 80, 140, -60, 100, 0],
                scale: [1, 1.08, 0.92, 1.12, 0.96, 1.04, 1],
                rotate: [0, -18, 8, -14, 12, -6, 0],
              }}
              transition={{
                duration: 36,
                repeat: Infinity,
                ease: "easeInOut",
                times: [0, 0.2, 0.38, 0.54, 0.7, 0.88, 1],
              }}
            />
            <div className="absolute left-1/3 top-0 -translate-x-1/2">
              <motion.div
                className="h-72 w-72 rounded-full bg-gradient-to-b from-amber-300/55 via-orange-300/40 to-rose-300/35 blur-3xl dark:from-violet-500/24 dark:via-fuchsia-600/14 dark:to-slate-950/35"
                animate={{
                  x: [0, -140, 200, -90, 260, 30, 0],
                  y: [0, 160, 50, -130, 90, -70, 0],
                  opacity: [0.55, 0.88, 0.72, 0.95, 0.62, 0.82, 0.55],
                  scale: [1, 1.1, 0.9, 1.08, 0.94, 1.04, 1],
                }}
                transition={{
                  duration: 28,
                  repeat: Infinity,
                  ease: "easeInOut",
                  times: [0, 0.17, 0.34, 0.5, 0.66, 0.83, 1],
                }}
              />
            </div>
          </>
        )}

        {/* Light: lighter vignette so blurred orbs stay visible; dark: stronger edge falloff */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(15,23,42,0.045)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.55)_100%)]" />

        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent dark:via-cyan-400/40" />
      </div>

      {/* Pencil scribble trail — canvas (replaces radial cursor glow) */}
      {!reduce && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none fixed inset-0 z-[6]"
          aria-hidden
        />
      )}

      <ThemeToggle variant="floating" />

      {/* Login burst icons portal target: below z-10 auth card, outside overflow clip */}
      <div
        id="auth-viewport-layer"
        className="pointer-events-none fixed inset-0 z-[8] overflow-visible"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 pt-20 md:pt-10">
        <div className="w-full max-w-md">
          <PageTransition>{children}</PageTransition>
        </div>
      </div>
    </div>
  );
}
