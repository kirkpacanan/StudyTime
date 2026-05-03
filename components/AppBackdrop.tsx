"use client";

import { motion, useReducedMotion } from "framer-motion";

export function AppBackdrop() {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-bg"
        aria-hidden
      />
    );
  }

  return (
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg bg-[linear-gradient(155deg,var(--bg)_0%,color-mix(in_srgb,var(--bg)_82%,var(--primary))_48%,var(--bg)_100%)] dark:bg-[linear-gradient(160deg,#060912_0%,#0c1528_50%,#070b14_100%)]"
        aria-hidden
      >
      <div
        className="absolute inset-0 opacity-[0.32] dark:opacity-[0.52]"
        style={{
          backgroundImage: `linear-gradient(rgba(79,134,247,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79,134,247,0.06) 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
        }}
      />
      <motion.div
        className="absolute -right-32 top-0 h-[420px] w-[420px] rounded-full bg-primary/12 blur-3xl dark:bg-cyan-500/15"
        animate={{ rotate: [0, 8, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -left-40 bottom-0 h-[380px] w-[380px] rounded-full bg-success/10 blur-3xl dark:bg-indigo-500/12"
        animate={{ rotate: [0, -6, 0], y: [0, -16, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent dark:via-cyan-400/25" />
    </div>
  );
}
