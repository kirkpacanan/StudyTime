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
          "fixed right-4 top-4 z-[60] h-11 w-11 border-primary/20 bg-surface/90 text-text shadow-lg backdrop-blur-md hover:border-primary/40 hover:shadow-[0_0_24px_-4px_rgba(79,134,247,0.45)] dark:border-white/10 dark:bg-slate-900/80 dark:text-amber-200/90 dark:hover:border-cyan-400/30",
        variant === "inline" &&
          "h-9 w-9 border-primary/15 bg-surface/80 text-text hover:bg-primary-soft/60 dark:border-white/10 dark:bg-slate-800/80 dark:text-amber-200/90 dark:hover:bg-slate-700/80",
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
