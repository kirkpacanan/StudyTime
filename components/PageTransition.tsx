"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { SESSION_EASE } from "@/lib/library/session-motion";

const ease = [0.16, 1, 0.3, 1] as const;

function isSessionRoute(pathname: string) {
  return pathname === "/session" || pathname.startsWith("/session/");
}

/**
 * Route enter animation without `AnimatePresence mode="wait"`, which kept the
 * incoming page off-screen until the previous route finished exiting (blank main area).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const session = isSessionRoute(pathname);

  return (
    <div className="min-h-0 w-full">
      <motion.div
        key={pathname}
        initial={
          reduce
            ? false
            : session
              ? { opacity: 0 }
              : { opacity: 0, y: 10 }
        }
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduce ? 0.01 : session ? 0.5 : 0.22,
          ease: session ? SESSION_EASE : ease,
        }}
        className="min-h-0 w-full"
      >
        {children}
      </motion.div>
    </div>
  );
}
