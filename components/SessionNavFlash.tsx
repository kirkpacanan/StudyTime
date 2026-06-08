"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SESSION_EASE } from "@/lib/library/session-motion";

function isSessionRoute(path: string) {
  return path === "/session" || path.startsWith("/session/");
}

/**
 * Gentle crossfade when navigating into the study session route.
 */
export function SessionNavFlash() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const prevPath = useRef(pathname);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const entering = isSessionRoute(pathname) && !isSessionRoute(prevPath.current);
    prevPath.current = pathname;
    if (!entering || reduce) return;

    setActive(true);
    const t = window.setTimeout(() => setActive(false), 1100);
    return () => clearTimeout(t);
  }, [pathname, reduce]);

  if (reduce) return null;

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key="session-nav-flash"
          className="pointer-events-none fixed inset-0 z-[300] bg-[#1a1206]"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.05, ease: SESSION_EASE }}
          aria-hidden
        />
      ) : null}
    </AnimatePresence>
  );
}
