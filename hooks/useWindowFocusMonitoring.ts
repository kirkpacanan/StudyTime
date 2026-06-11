"use client";

import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 800;

/**
 * Fires when the user leaves the study tab/window while `active`.
 * Combines visibilitychange + blur with debounce to reduce false positives.
 */
export function useWindowFocusMonitoring(
  active: boolean,
  onTabSwitch: (hiddenMs: number) => void,
) {
  const hiddenAtRef = useRef<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTabSwitchRef = useRef(onTabSwitch);
  onTabSwitchRef.current = onTabSwitch;

  useEffect(() => {
    if (!active) {
      hiddenAtRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    const maybeFire = () => {
      const hidden = document.hidden || !document.hasFocus();
      if (hidden) {
        if (hiddenAtRef.current == null) hiddenAtRef.current = Date.now();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (!document.hidden && document.hasFocus()) return;
          const start = hiddenAtRef.current ?? Date.now();
          const duration = Date.now() - start;
          if (duration >= DEBOUNCE_MS) {
            onTabSwitchRef.current(duration);
          }
        }, DEBOUNCE_MS);
      } else {
        hiddenAtRef.current = null;
        if (debounceRef.current) clearTimeout(debounceRef.current);
      }
    };

    const onVisibility = () => maybeFire();
    const onBlur = () => maybeFire();
    const onFocus = () => {
      hiddenAtRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [active]);
}
