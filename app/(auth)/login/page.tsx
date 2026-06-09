"use client";

import { Caveat } from "next/font/google";
import { StudyTimeWordmark } from "@/components/StudyTimeLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/hooks/useAuth";
import { signIn } from "@/lib/auth";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  BookMarked,
  BookOpen,
  Brain,
  Clock,
  GraduationCap,
  Laptop,
  Pencil,
  Timer,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ease = [0.16, 1, 0.3, 1] as const;

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.03 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease },
  },
};

type PrePhase = "copy" | "cta" | "burst";
type PagePhase = "auth" | "form";

const LINES = [
  { text: "Are you", className: "text-text dark:text-slate-100" },
  { text: "ready to", className: "text-muted dark:text-slate-400" },
  {
    text: "Study?",
    className:
      "bg-gradient-to-r from-[#1d4ed8] via-[#0d9488] to-[#047857] bg-clip-text text-transparent dark:from-sky-400 dark:via-cyan-400 dark:to-emerald-400",
  },
];

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

/** Handwriting / pencil reveal */
const PENCIL_STAGGER = 0.048;
const PENCIL_DURATION = 0.34;
const pencilEase = [0.24, 0.55, 0.38, 1] as const;

function pencilDelay(charIndex: number) {
  return 0.1 + charIndex * PENCIL_STAGGER + ((charIndex * 3) % 5) * 0.008;
}

/** Slight tilt variation per letter, like natural script */
function pencilTilt(charIndex: number) {
  return -5.5 + ((charIndex * 11 + 2) % 12);
}

/** First two lines only — per-letter animation; “Study?” is one span to avoid clipping */
const LINES_CHAR_ANIM = [LINES[0], LINES[1]] as const;
const STUDY_LINE = LINES[2];
const CHAR_COUNT_BEFORE_STUDY =
  LINES[0].text.length + LINES[1].text.length;

/** Resting icon centers as % of viewport (0–100). Remapped for a clear ring around the form. */
type BurstTargetSpec = {
  Icon: LucideIcon;
  cx: number;
  cy: number;
  w: number;
};

const BURST_TARGETS: BurstTargetSpec[] = [
  { Icon: BookOpen, cx: 10, cy: 12, w: 52 },
  { Icon: Clock, cx: 90, cy: 14, w: 46 },
  { Icon: Pencil, cx: 11, cy: 78, w: 42 },
  { Icon: Brain, cx: 89, cy: 74, w: 52 },
  { Icon: GraduationCap, cx: 50, cy: 8, w: 46 },
  { Icon: Laptop, cx: 18, cy: 42, w: 40 },
  { Icon: Timer, cx: 84, cy: 46, w: 40 },
  { Icon: BookMarked, cx: 8, cy: 54, w: 44 },
];

/** Show sign-in card shortly after burst begins so it doesn’t feel stuck waiting */
const BURST_TO_FORM_MS = 980;

/** Tight ring (px) around Start center — stack behind the pill before burst */
const BURST_STACK_RING_PX = 5.5;

const AUTH_VIEWPORT_LAYER_ID = "auth-viewport-layer";

/** Offset so icons sit in a small ring behind the Start button (shared CTA + burst t=0). */
function burstStackOffset(index: number, radiusPx: number) {
  const n = BURST_TARGETS.length;
  const a = (index / n) * Math.PI * 2 + 0.42;
  return { dx: Math.cos(a) * radiusPx, dy: Math.sin(a) * radiusPx };
}

/** Viewport + spawn center (px). Burst uses transform x/y — Framer tweens pixels reliably here. */
type BurstGeom = {
  vw: number;
  vh: number;
  /** Spawn center X (px) — Start button center */
  ox: number;
  /** Spawn center Y (px) — Start button center */
  oy: number;
};

function burstKeyframe(
  x: number,
  y: number,
  scale: number,
  opacity: number,
): Keyframe {
  return {
    transform: `translate(${x}px, ${y}px) scale(${scale})`,
    opacity,
  };
}

/** Web Animations API — avoids Framer initial/animate quirks inside portals. */
function getBurstWebKeyframes(
  g: BurstGeom,
  spec: BurstTargetSpec,
  index: number,
  reduceMotion: boolean,
): { keyframes: Keyframe[]; options: KeyframeAnimationOptions } {
  const { vw, vh, ox, oy } = g;
  const half = spec.w / 2;
  const n = BURST_TARGETS.length;
  const { dx, dy } = burstStackOffset(index, BURST_STACK_RING_PX);

  const x0 = ox - half + dx;
  const y0 = oy - half + dy;

  const endCx = (spec.cx / 100) * vw;
  const endCy = (spec.cy / 100) * vh;
  const x2 = endCx - half;
  const y2 = endCy - half;

  const liftSpread = ((index / n) - 0.5) * vw * 0.18;
  const xLift = ox - half + liftSpread + dx * 1.1;
  const yLift = oy - half - vh * 0.09;

  const xEarly = ox + (endCx - ox) * 0.34 - half;
  const yEarly = oy + (endCy - oy) * 0.34 - half - vh * 0.022;

  const xMid = ox + (endCx - ox) * 0.62 - half;
  const yMid = oy + (endCy - oy) * 0.62 - half;

  if (reduceMotion) {
    return {
      keyframes: [
        { ...burstKeyframe(x0, y0, 0.4, 0.45), offset: 0 },
        { ...burstKeyframe(x2, y2, 1, 0.58), offset: 1 },
      ],
      options: {
        duration: 380,
        delay: index * 32,
        easing: "ease-out",
        fill: "forwards",
      },
    };
  }

  return {
    keyframes: [
      { ...burstKeyframe(x0, y0, 0.3, 0.55), offset: 0 },
      { ...burstKeyframe(xLift, yLift, 0.52, 0.78), offset: 0.17 },
      { ...burstKeyframe(xEarly, yEarly, 0.82, 0.9), offset: 0.4 },
      { ...burstKeyframe(xMid, yMid, 1, 0.92), offset: 0.66 },
      { ...burstKeyframe(x2, y2, 1, 0.58), offset: 1 },
    ],
    options: {
      duration: 1200,
      delay: index * 42,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    },
  };
}

function BurstFlyingIcon({
  geom,
  index,
  reduceMotion,
}: {
  geom: BurstGeom;
  index: number;
  reduceMotion: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(false);
  const spec = BURST_TARGETS[index]!;
  const Icon = spec.Icon;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    setSettled(false);

    const s = BURST_TARGETS[index]!;
    const { keyframes, options } = getBurstWebKeyframes(
      geom,
      s,
      index,
      reduceMotion,
    );

    const first = keyframes[0] as { transform?: string; opacity?: number };
    if (first.transform) el.style.transform = first.transform;
    if (typeof first.opacity === "number") {
      el.style.opacity = String(first.opacity);
    }

    let anim: Animation | null = null;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        anim = el.animate(keyframes, options);
        anim.finished
          .then(() => {
            if (!cancelled) setSettled(true);
          })
          .catch(() => {
            /* aborted */
          });
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      anim?.cancel();
    };
  }, [geom.vw, geom.vh, geom.ox, geom.oy, index, reduceMotion]);

  const idle =
    settled &&
    !reduceMotion && {
      y: [0, -14, 0],
      rotateZ: [0, 5.5, -5.5, 0],
    };

  return (
    <div
      ref={ref}
      className="fixed left-0 top-0 text-primary/60 dark:text-cyan-300/55"
      style={{
        width: spec.w,
        height: spec.w,
        willChange: "transform, opacity",
      }}
    >
      <motion.div
        className="h-full w-full will-change-transform"
        initial={false}
        animate={idle || { y: 0, rotateZ: 0 }}
        transition={
          idle
            ? {
                duration: 4.2 + (index % 4) * 0.35,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.05,
              }
            : { duration: 0 }
        }
      >
        <Icon className="h-full w-full opacity-90" strokeWidth={1.25} aria-hidden />
      </motion.div>
    </div>
  );
}

function BurstField({
  geom,
  reduceMotion,
}: {
  geom: BurstGeom;
  reduceMotion: boolean;
}) {
  return (
    <>
      {BURST_TARGETS.map((_, i) => (
        <BurstFlyingIcon
          key={i}
          geom={geom}
          index={i}
          reduceMotion={reduceMotion}
        />
      ))}
    </>
  );
}

export default function LoginPage() {
  const { user, ready, refreshUser } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const startBtnRef = useRef<HTMLButtonElement>(null);

  const [page, setPage] = useState<PagePhase>("auth");
  const [pre, setPre] = useState<PrePhase>("copy");
  const [burstGeom, setBurstGeom] = useState<BurstGeom | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [burstLayerEl, setBurstLayerEl] = useState<HTMLElement | null>(null);
  /** Bumps when Start is pressed so the burst tree remounts and fly-in always runs */
  const [burstWave, setBurstWave] = useState(0);

  useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, user, router]);

  useLayoutEffect(() => {
    setPortalReady(true);
    setBurstLayerEl(document.getElementById(AUTH_VIEWPORT_LAYER_ID));
    if (reduce === true) setPage("form");
  }, [reduce]);

  useEffect(() => {
    if (reduce === true) return;
    if (page !== "auth" || pre !== "copy") return;
    const id = window.setTimeout(() => setPre("cta"), 1750);
    return () => window.clearTimeout(id);
  }, [page, pre, reduce]);

  useEffect(() => {
    if (reduce === true) return;
    if (page !== "auth" || pre !== "burst") return;
    const id = window.setTimeout(() => setPage("form"), BURST_TO_FORM_MS);
    return () => window.clearTimeout(id);
  }, [page, pre, reduce]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await signIn(email, password);
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    refreshUser();
    router.replace("/dashboard");
  }

  function handleStart() {
    if (reduce === true) {
      setPage("form");
      return;
    }
    if (typeof window !== "undefined") {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const el = startBtnRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        setBurstGeom({
          vw,
          vh,
          ox: r.left + r.width / 2,
          oy: r.top + r.height / 2,
        });
      } else {
        setBurstGeom({
          vw,
          vh,
          ox: vw / 2,
          oy: vh * 0.72,
        });
      }
    }
    setBurstWave((w) => w + 1);
    setPre("burst");
  }

  if (!ready) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease }}
      >
        <Card
          variant="auth"
          className="auth-glass auth-glow-ring p-6 text-center text-sm text-muted md:p-8"
        >
          Preparing your workspace…
        </Card>
      </motion.div>
    );
  }

  const showBurstIcons =
    !reduce && (pre === "burst" || page === "form");

  const introOverlay =
    portalReady &&
    createPortal(
      <AnimatePresence>
        {page === "auth" && pre !== "burst" ? (
          <motion.div
            key="intro-shell"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drama-headline"
            className="pointer-events-none fixed inset-0 z-[55] flex flex-col items-center justify-center overflow-visible px-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              filter: reduce ? "none" : "blur(10px)",
            }}
            transition={{ duration: 0.55, ease }}
          >
            <LayoutGroup id="login-intro-layout">
              <motion.div
                layout={reduce !== true}
                className="pointer-events-auto flex w-full max-w-[min(100vw-1.25rem,54rem)] flex-col items-center overflow-visible text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.96, y: -12 }}
                transition={{
                  layout: {
                    type: "spring",
                    stiffness: 150,
                    damping: 34,
                    mass: 0.95,
                  },
                  opacity: { duration: 0.35, ease },
                }}
              >
              <motion.div
                layout={reduce !== true}
                id="drama-headline"
                className={`${caveat.className} mx-auto flex w-full min-w-0 max-w-[min(100vw-0.5rem,58rem)] flex-nowrap items-baseline justify-center gap-x-2 overflow-x-auto overflow-y-visible px-1 pb-2 pr-3 text-center text-[clamp(1.55rem,5.1vw+0.45rem,3.35rem)] font-semibold leading-[1.35] tracking-wide text-text [scrollbar-width:none] md:gap-x-3 [&::-webkit-scrollbar]:hidden`}
              >
                {(() => {
                  let charIndex = 0;
                  return (
                    <>
                      {LINES_CHAR_ANIM.map((line) => (
                        <span
                          key={line.text}
                          className="inline-flex shrink-0 flex-nowrap items-baseline overflow-visible"
                        >
                          {Array.from(line.text).map((ch, j) => {
                            const idx = charIndex++;
                            const display = ch === " " ? "\u00A0" : ch;
                            return (
                              <motion.span
                                key={`${line.text}-${j}`}
                                className={`inline-block origin-bottom align-baseline [overflow:visible] drop-shadow-[0_1px_0_rgba(255,255,255,0.65)] dark:drop-shadow-[0_1px_0_rgba(0,0,0,0.35)] ${line.className}`}
                                initial={
                                  reduce === true
                                    ? false
                                    : {
                                        opacity: 0.12,
                                        y: 7,
                                        x: -4,
                                        rotate: pencilTilt(idx),
                                        scale: 0.94,
                                        filter:
                                          "grayscale(1) contrast(0.88) brightness(1.06)",
                                      }
                                }
                                animate={{
                                  opacity: 1,
                                  y: 0,
                                  x: 0,
                                  rotate: 0,
                                  scale: 1,
                                  filter:
                                    "grayscale(0) contrast(1) brightness(1)",
                                }}
                                transition={{
                                  duration:
                                    reduce === true ? 0 : PENCIL_DURATION,
                                  delay:
                                    reduce === true ? 0 : pencilDelay(idx),
                                  ease: pencilEase,
                                }}
                              >
                                {display}
                              </motion.span>
                            );
                          })}
                        </span>
                      ))}
                      <motion.span
                        className="inline-flex max-w-none shrink-0 origin-bottom flex-nowrap items-baseline overflow-visible pl-0.5 pr-2"
                        initial={
                          reduce === true
                            ? false
                            : {
                                opacity: 0.15,
                                y: 9,
                                x: -5,
                                rotate: -3,
                                scale: 0.96,
                                filter:
                                  "grayscale(1) contrast(0.9) brightness(1.05)",
                              }
                        }
                        animate={{
                          opacity: 1,
                          y: 0,
                          x: 0,
                          rotate: 0,
                          scale: 1,
                          filter:
                            "grayscale(0) contrast(1) brightness(1)",
                        }}
                        transition={{
                          duration:
                            reduce === true ? 0 : PENCIL_DURATION + 0.12,
                          delay:
                            reduce === true
                              ? 0
                              : pencilDelay(CHAR_COUNT_BEFORE_STUDY),
                          ease: pencilEase,
                        }}
                      >
                        <span
                          className={`inline-block whitespace-nowrap py-1 pl-[0.06em] pr-[0.55em] ${STUDY_LINE.className}`}
                        >
                          {STUDY_LINE.text}
                        </span>
                      </motion.span>
                    </>
                  );
                })()}
              </motion.div>

              <motion.p
                layout={reduce !== true}
                className="mt-6 max-w-md text-sm text-muted dark:text-slate-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  layout: {
                    type: "spring",
                    stiffness: 150,
                    damping: 34,
                    mass: 0.95,
                  },
                  delay:
                    reduce === true
                      ? 0.65
                      : pencilDelay(CHAR_COUNT_BEFORE_STUDY) +
                        (PENCIL_DURATION + 0.12) +
                        0.16,
                  duration: 0.45,
                }}
              >
                Lock in. Breathe. Your focus session starts here.
              </motion.p>

              <AnimatePresence>
                {pre === "cta" && (
                  <motion.div
                    key="cta"
                    layout={reduce !== true}
                    className="mt-12 flex flex-col items-center gap-3"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{
                      layout: {
                        type: "spring",
                        stiffness: 150,
                        damping: 34,
                        mass: 0.95,
                      },
                      opacity: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
                      y: {
                        type: "spring",
                        stiffness: 200,
                        damping: 32,
                        mass: 0.85,
                      },
                    }}
                  >
                    <div className="relative flex flex-col items-center">
                      {/* Frozen ring behind Start — same offsets as burst t=0; no motion until Start (portal burst). */}
                      <div
                        className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
                        aria-hidden
                      >
                        {BURST_TARGETS.map((T, j) => {
                          const { dx, dy } = burstStackOffset(
                            j,
                            BURST_STACK_RING_PX,
                          );
                          return (
                            <div
                              key={`warp-pack-${j}`}
                              className="absolute flex h-10 w-10 items-center justify-center text-primary/25 dark:text-cyan-300/25"
                              style={{
                                transform: `translate(${dx}px, ${dy}px)`,
                              }}
                            >
                              <T.Icon
                                className="h-full w-full blur-[3px]"
                                strokeWidth={1.35}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <motion.button
                        ref={startBtnRef}
                        type="button"
                        onClick={handleStart}
                        className="relative z-10 overflow-hidden rounded-full border border-white/50 bg-gradient-to-r from-primary/82 via-indigo-500/78 to-primary/82 px-14 py-4 text-lg font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.3)_inset,0_8px_36px_-8px_rgba(79,134,247,0.5)] backdrop-blur-xl backdrop-saturate-200 dark:border-cyan-200/30 dark:from-cyan-500/75 dark:via-primary/72 dark:to-indigo-600/75 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_8px_40px_-6px_rgba(34,211,238,0.38)]"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 28,
                        }}
                      >
                        <motion.span
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                          initial={{ x: "-100%" }}
                          animate={{ x: "200%" }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatDelay: 0.45,
                            ease: "easeInOut",
                          }}
                        />
                        <span className="relative z-10">Start</span>
                      </motion.button>
                    </div>
                    <p className="text-xs text-muted dark:text-slate-500">
                      Select Start to proceed to the sign-in page.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            </LayoutGroup>
          </motion.div>
        ) : null}
      </AnimatePresence>,
      document.body,
    );

  const burstMount =
    burstLayerEl ??
    (typeof document !== "undefined" ? document.body : null);

  /**
   * key={burstWave} forces BurstField to fully unmount+remount on every Start click
   * so Framer Motion always fires initial → animate from the button center.
   */
  const burstOverlay =
    portalReady &&
    burstMount &&
    showBurstIcons &&
    burstGeom &&
    createPortal(
      burstLayerEl ? (
        <BurstField key={burstWave} geom={burstGeom} reduceMotion={!!reduce} />
      ) : (
        <div className="pointer-events-none fixed inset-0 z-[8] overflow-visible [perspective:1200px]">
          <BurstField key={burstWave} geom={burstGeom} reduceMotion={!!reduce} />
        </div>
      ),
      burstMount,
    );

  return (
    <div className="relative min-h-[70vh]">
      {introOverlay}
      {burstOverlay}
      <AnimatePresence mode="wait">
        {page === "form" ? (
          <motion.div
            key="form"
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-0"
          >
            <Card variant="auth" className="auth-glass auth-glow-ring overflow-hidden p-6 md:p-8">
              <motion.div variants={item}>
                <StudyTimeWordmark logoSize={44} className="mb-6" />
              </motion.div>
              <motion.h1
                variants={item}
                className="text-xl font-semibold tracking-tight text-text"
              >
                Welcome back
              </motion.h1>
              <motion.p variants={item} className="mt-1 text-sm text-muted">
                Sign in to track focus and weekly performance.
              </motion.p>
              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                <motion.div variants={item}>
                  <label
                    className="text-xs font-medium text-muted"
                    htmlFor="email"
                  >
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                    required
                  />
                </motion.div>
                <motion.div variants={item}>
                  <div className="flex items-center justify-between">
                    <label
                      className="text-xs font-medium text-muted"
                      htmlFor="password"
                    >
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-medium text-primary underline-offset-4 transition hover:underline dark:text-cyan-300"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <PasswordInput
                    id="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1"
                    required
                  />
                </motion.div>
                {err ? (
                  <motion.p
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-sm text-alert"
                  >
                    {err}
                  </motion.p>
                ) : null}
                <motion.div variants={item}>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </motion.div>
              </form>
              <motion.p
                variants={item}
                className="mt-3 text-center text-sm text-muted"
              >
                New here?{" "}
                <Link
                  className="font-medium text-primary underline-offset-4 transition hover:underline dark:text-cyan-300"
                  href="/signup"
                >
                  Create an account
                </Link>
              </motion.p>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
