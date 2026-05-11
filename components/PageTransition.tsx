"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Route enter animation without `AnimatePresence mode="wait"`, which kept the
 * incoming page off-screen until the previous route finished exiting (blank main area).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <div className="min-h-0 w-full">
      <motion.div
        key={pathname}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduce ? 0.01 : 0.22,
          ease,
        }}
        className="min-h-0 w-full"
      >
        {children}
      </motion.div>
    </div>
  );
}
