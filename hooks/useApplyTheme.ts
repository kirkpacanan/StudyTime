"use client";

import { useEffect } from "react";
import { COSMETICS_BY_ID } from "@/lib/gamification/cosmetics";
import { useProgression } from "@/contexts/progression-context";

// CSS variable defaults that match globals.css — restored when no theme is active.
const LIGHT_DEFAULTS: Record<string, string> = {
  "--primary": "#4f86f7",
  "--primary-soft": "#e6effe",
};
const DARK_DEFAULTS: Record<string, string> = {
  "--primary": "#6b9cff",
  "--primary-soft": "rgba(107, 156, 255, 0.16)",
};

/** Blend a hex color toward white by `amount` (0 = original, 1 = white). */
function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

/** Convert a hex color to rgba() with the given alpha. */
function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Reads the user's equipped cosmetic theme from the progression context and
 * applies the theme's accent color to the global CSS custom properties
 * (`--primary`, `--primary-soft`).
 *
 * Also watches for light/dark mode class changes so the correct tint is used
 * in both modes without requiring a page reload.
 *
 * Mount this once at the app shell level (AppShell) — it is a no-op on the
 * server and during auth loading states.
 */
export function useApplyTheme() {
  const { snapshot } = useProgression();

  useEffect(() => {
    const root = document.documentElement;

    function apply() {
      const themeId = snapshot?.loadout.themeId;
      const isDark = root.classList.contains("dark");

      // No theme or default: restore globals.css values.
      if (!themeId || themeId === "theme_default") {
        const defaults = isDark ? DARK_DEFAULTS : LIGHT_DEFAULTS;
        for (const [key, val] of Object.entries(defaults)) {
          root.style.setProperty(key, val);
        }
        return;
      }

      const cosmetic = COSMETICS_BY_ID[themeId];
      if (!cosmetic || cosmetic.type !== "theme") {
        console.warn(
          `[useApplyTheme] Unknown or non-theme cosmetic id: "${themeId}". Falling back to default.`,
        );
        const defaults = isDark ? DARK_DEFAULTS : LIGHT_DEFAULTS;
        for (const [key, val] of Object.entries(defaults)) {
          root.style.setProperty(key, val);
        }
        return;
      }

      const accent = cosmetic.metadata.accent as string;

      if (isDark) {
        // Lighten the accent so it reads well on dark backgrounds.
        root.style.setProperty("--primary", lighten(accent, 0.22));
        root.style.setProperty("--primary-soft", hexRgba(accent, 0.16));
      } else {
        root.style.setProperty("--primary", accent);
        root.style.setProperty("--primary-soft", hexRgba(accent, 0.14));
      }
    }

    apply();

    // Re-apply whenever the user toggles light/dark mode.
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, [snapshot?.loadout.themeId]);
}
