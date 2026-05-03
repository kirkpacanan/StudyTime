"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

const easeSmooth = [0.16, 1, 0.3, 1] as const;

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, y: 16, scale: 0.988, filter: "blur(6px)" }
        }
        animate={
          reduce
            ? { opacity: 1 }
            : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
        }
        exit={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, y: -12, scale: 0.992, filter: "blur(4px)" }
        }
        transition={{
          duration: reduce ? 0.12 : 0.42,
          ease: easeSmooth,
        }}
        className="will-change-transform"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
