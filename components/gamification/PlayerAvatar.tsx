"use client";

import { cn } from "@/lib/cn";
import {
  COSMETICS_BY_ID,
  DEFAULT_AVATAR_ID,
  DEFAULT_FRAME_ID,
  dicebearUrl,
} from "@/lib/gamification/cosmetics";
import { Crown } from "lucide-react";

/** Resolve the avatar image URL for a given avatar cosmetic id + seed. */
export function avatarUrlFor(avatarId: string, seed: string): string {
  const cosmetic = COSMETICS_BY_ID[avatarId];
  const style =
    (cosmetic?.metadata?.style as string | undefined) ?? "avataaars";
  return dicebearUrl(style, seed);
}

// ── Particle Aura config ──────────────────────────────────────────────────────
// Each entry defines one orbiting particle for the Animated Aura frame.
// `orbit` = distance from SVG centre in viewBox units (viewBox 0 0 100 100).
// `dur`   = seconds per full revolution.
// `delay` = negative animation-delay to stagger starting positions.
const AURA_PARTICLES = [
  { orbit: 44, r: 3.0, color: "rgba(248,113,113,0.92)", dur: 5.0, delay: "0s" },
  { orbit: 46, r: 2.3, color: "rgba(251,191,36,0.92)", dur: 5.0, delay: "-0.83s" },
  { orbit: 43, r: 3.2, color: "rgba(74,222,128,0.92)", dur: 5.0, delay: "-1.67s" },
  { orbit: 45, r: 2.5, color: "rgba(56,189,248,0.92)", dur: 5.0, delay: "-2.5s" },
  { orbit: 44, r: 2.0, color: "rgba(167,139,250,0.92)", dur: 5.0, delay: "-3.33s" },
  { orbit: 46, r: 2.8, color: "rgba(244,114,182,0.92)", dur: 5.0, delay: "-4.17s" },
  // Inner orbit — smaller dust particles for depth
  { orbit: 40, r: 1.7, color: "rgba(248,113,113,0.6)", dur: 3.4, delay: "-1.1s" },
  { orbit: 41, r: 1.4, color: "rgba(56,189,248,0.6)", dur: 3.4, delay: "-2.8s" },
] as const;

// ── Prismatic Shard config ────────────────────────────────────────────────────
// Each entry defines one orbiting diamond shard for the Prismatic Pulse frame.
// `size`    = half-height of the diamond in viewBox units.
// `spinDur` = seconds for the shard to complete one self-rotation.
const PRISMATIC_SHARDS = [
  { orbit: 44, size: 4.5, color: "rgba(103,232,249,0.92)", dur: 7.0, spinDur: 2.0, delay: "0s" },
  { orbit: 44, size: 3.6, color: "rgba(167,139,250,0.92)", dur: 7.0, spinDur: 2.5, delay: "-1.4s" },
  { orbit: 44, size: 4.2, color: "rgba(244,114,182,0.92)", dur: 7.0, spinDur: 1.8, delay: "-2.8s" },
  { orbit: 44, size: 3.8, color: "rgba(34,211,238,0.92)", dur: 7.0, spinDur: 2.2, delay: "-4.2s" },
  { orbit: 44, size: 4.0, color: "rgba(192,132,252,0.92)", dur: 7.0, spinDur: 1.5, delay: "-5.6s" },
] as const;

/** Returns SVG `points` for a diamond centred at (cx, cy) with given half-height. */
function diamondPoints(cx: number, cy: number, size: number): string {
  const hw = size * 0.55;
  return `${cx},${cy - size} ${cx + hw},${cy} ${cx},${cy + size} ${cx - hw},${cy}`;
}

export function PlayerAvatar({
  avatarId = DEFAULT_AVATAR_ID,
  frameId = DEFAULT_FRAME_ID,
  seed,
  size = 56,
  className,
}: {
  avatarId?: string;
  frameId?: string;
  seed: string;
  size?: number;
  className?: string;
}) {
  const frame = COSMETICS_BY_ID[frameId];
  // ringCss is the CSS box-shadow value stored directly in the cosmetic metadata.
  // Using inline styles guarantees the ring always renders regardless of whether
  // Tailwind has compiled the corresponding utility classes into the CSS bundle.
  const ringCss =
    (frame?.metadata?.ringCss as string | undefined) ??
    "0 0 0 2px rgba(255,255,255,0.4)";
  const animatedClass =
    frame?.animated && frame.metadata?.animatedClass
      ? (frame.metadata.animatedClass as string)
      : "";
  const hasCrown = Boolean(frame?.metadata?.crown);
  const hasHalo = Boolean(frame?.metadata?.halo);
  const hasParticles = Boolean(frame?.metadata?.particles);
  const hasShards = Boolean(frame?.metadata?.shards);

  // SVG overlay size: 60% larger than the avatar so particles can orbit outside the ring.
  const overlaySize = size * 1.6;
  const overlayOffset = -(size * 0.3);

  return (
    // Outer div carries BOTH the ring (box-shadow) and the animation class.
    //
    // Why the animation must be on the outer div, not the inner:
    //   • Frame animation classes animate `filter: drop-shadow(...)`.
    //   • CSS `filter` creates an isolated compositing layer. When applied to
    //     a div that also has `overflow: hidden`, the filter's output region is
    //     bounded by the clip — the drop-shadow glow that should radiate OUTSIDE
    //     the circle is swallowed.
    //   • The outer div has no `overflow` restriction, so `filter: drop-shadow`
    //     can radiate freely around the entire visual (ring + avatar).
    //   • `rounded-full` on the outer div makes the ring box-shadow circular.
    <div
      className={cn("relative shrink-0 rounded-full", animatedClass, className)}
      style={{ width: size, height: size, boxShadow: ringCss }}
    >
      {hasCrown ? (
        // Wrapper div handles horizontal centering; Crown bobs vertically.
        <div
          className="absolute left-1/2 z-10"
          style={{
            top: -(size * 0.18),
            transform: "translateX(-50%)",
            width: size * 0.44,
            height: size * 0.44,
          }}
        >
          <Crown
            className="cosmetic-crown-bob h-full w-full text-amber-400"
            aria-hidden
          />
        </div>
      ) : null}

      {hasHalo ? (
        // Angel's halo — tilted ellipse ring floating above the avatar head.
        <div
          className="absolute left-1/2 z-10"
          style={{
            top: -(size * 0.22),
            transform: "translateX(-50%)",
            width: size * 0.7,
          }}
        >
          <svg
            className="cosmetic-halo-glow w-full"
            viewBox="0 0 70 26"
            aria-hidden
          >
            {/* Outer glow ring */}
            <ellipse
              cx="35"
              cy="13"
              rx="30"
              ry="9"
              fill="none"
              stroke="rgba(253,224,71,0.35)"
              strokeWidth="6"
            />
            {/* Main halo ring */}
            <ellipse
              cx="35"
              cy="13"
              rx="30"
              ry="9"
              fill="none"
              stroke="#FDE047"
              strokeWidth="3"
            />
            {/* Inner highlight streak */}
            <ellipse
              cx="35"
              cy="13"
              rx="30"
              ry="9"
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="1"
              strokeDasharray="18 62"
              strokeDashoffset="8"
            />
          </svg>
        </div>
      ) : null}

      {/* Inner div only clips the avatar — no animation, no box-shadow. */}
      <div className="h-full w-full overflow-hidden rounded-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrlFor(avatarId, seed)}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      </div>

      {hasParticles ? (
        // Particle aura — rendered after the avatar so particles sit on top of the ring
        // but orbit outside the avatar face. Each <g> rotates around the SVG centre
        // (50,50) via CSS transform-origin; the particle itself is offset along the y-axis.
        <div
          className="pointer-events-none absolute"
          style={{
            width: overlaySize,
            height: overlaySize,
            top: overlayOffset,
            left: overlayOffset,
          }}
        >
          <svg className="h-full w-full" viewBox="0 0 100 100" aria-hidden>
            {AURA_PARTICLES.map((p, i) => (
              <g
                key={i}
                style={{
                  transformOrigin: "50px 50px",
                  animation: `orbit-cw ${p.dur}s linear infinite`,
                  animationDelay: p.delay,
                }}
              >
                <circle cx={50} cy={50 - p.orbit} r={p.r} fill={p.color} />
              </g>
            ))}
          </svg>
        </div>
      ) : null}

      {hasShards ? (
        // Prismatic shards — each <g> orbits the SVG centre; the <polygon> inside
        // self-spins using transform-box: fill-box so the diamond tumbles as it orbits.
        <div
          className="pointer-events-none absolute"
          style={{
            width: overlaySize,
            height: overlaySize,
            top: overlayOffset,
            left: overlayOffset,
          }}
        >
          <svg className="h-full w-full" viewBox="0 0 100 100" aria-hidden>
            {PRISMATIC_SHARDS.map((s, i) => {
              const cy = 50 - s.orbit;
              return (
                <g
                  key={i}
                  style={{
                    transformOrigin: "50px 50px",
                    animation: `orbit-cw ${s.dur}s linear infinite`,
                    animationDelay: s.delay,
                  }}
                >
                  <polygon
                    points={diamondPoints(50, cy, s.size)}
                    fill={s.color}
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      animation: `shard-tumble ${s.spinDur}s linear infinite`,
                      animationDelay: s.delay,
                    }}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      ) : null}
    </div>
  );
}
