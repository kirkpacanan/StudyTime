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
    // For the session route we must NOT apply any CSS transform here — even
    // `transform: translateY(0px)` creates a new containing block for
    // `position: fixed` children, which traps the immersive overlay inside the
    // app-shell content area instead of the full viewport.
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
        // Session route: only animate opacity so no transform is written to the
        // DOM.  Other routes keep the y slide-up.
        animate={session ? { opacity: 1 } : { opacity: 1, y: 0 }}
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
