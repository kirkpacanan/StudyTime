"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

const COLORS = [
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#38bdf8",
];

export function ConfettiBurst({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.25,
        dur: 1.8 + Math.random() * 0.8,
        rot: Math.random() * 360,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 8,
      })),
    [],
  );

  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-sm opacity-90"
          style={{
            left: `${p.x}%`,
            top: "-12px",
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size}px ${p.color}`,
          }}
          initial={{ y: -20, rotate: p.rot, opacity: 1 }}
          animate={{
            y: "110vh",
            rotate: p.rot + 720,
            opacity: [1, 1, 0.9, 0],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}
    </div>
  );
}
