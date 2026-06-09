"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SESSION_EASE } from "@/lib/library/session-motion";

/**
 * Soft warm glow that lingers after the nav flash — no second black wipe.
 */
export function SessionEnterOverlay() {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-[120] bg-[radial-gradient(ellipse_90%_70%_at_50%_38%,rgba(196,148,64,0.18)_0%,transparent_62%)]"
      initial={{ opacity: 0.85 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 1.15, delay: 0.08, ease: SESSION_EASE }}
      aria-hidden
    />
  );
}
