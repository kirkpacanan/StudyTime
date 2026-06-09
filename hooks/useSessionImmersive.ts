"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { SESSION_EASE } from "@/lib/library/session-motion";

/**
 * Optional immersive mode — expands the session over the app chrome (sidebar / topbar).
 * Normal mode keeps the session inside the main content area.
 */
export function useSessionImmersive() {
  const reduce = useReducedMotion();
  const [isImmersive, setIsImmersive] = useState(false);

  const enterImmersive = useCallback(() => setIsImmersive(true), []);
  const exitImmersive = useCallback(() => setIsImmersive(false), []);
  const toggleImmersive = useCallback(() => setIsImmersive((v) => !v), []);

  useEffect(() => {
    if (!isImmersive) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isImmersive]);

  const layoutTransition = reduce
    ? { duration: 0.01 }
    : { duration: 0.45, ease: SESSION_EASE };

  return {
    isImmersive,
    enterImmersive,
    exitImmersive,
    toggleImmersive,
    layoutTransition,
  };
}
