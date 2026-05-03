"use client";

import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/cn";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({
  className,
  variant = "floating",
}: {
  className?: string;
  /** floating = round icon button; inline = compact for topbar */
  variant?: "floating" | "inline";
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "flex items-center justify-center rounded-xl border transition duration-200",
        variant === "floating" &&
          "glass-floating-btn fixed right-4 top-4 z-[60] h-11 w-11 text-text hover:border-primary/35 hover:shadow-[0_0_28px_-4px_rgba(79,134,247,0.35)] dark:text-amber-200/90 dark:hover:border-cyan-400/25",
        variant === "inline" &&
          "h-9 w-9 border border-white/60 bg-white/[0.34] text-text shadow-[0_1px_0_0_rgba(255,255,255,0.65)_inset] backdrop-blur-xl backdrop-saturate-200 hover:bg-white/[0.46] dark:border-white/[0.2] dark:bg-slate-900/[0.4] dark:text-amber-200/90 dark:hover:bg-slate-900/[0.52]",
        className,
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-[1.1rem] w-[1.1rem]" strokeWidth={2} />
      ) : (
        <Moon className="h-[1.1rem] w-[1.1rem]" strokeWidth={2} />
      )}
    </button>
  );
}
