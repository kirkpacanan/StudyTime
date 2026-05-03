import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

const tones = {
  blue: "border-primary/30 bg-primary-soft/75 text-primary backdrop-blur-lg backdrop-saturate-200 dark:border-primary/35 dark:bg-primary/16",
  green:
    "border-success/35 bg-success/18 text-success backdrop-blur-lg backdrop-saturate-200 dark:border-success/40 dark:bg-success/14",
  yellow:
    "border-accent/45 bg-accent/28 text-text backdrop-blur-lg backdrop-saturate-200 dark:border-accent/35 dark:bg-accent/16 dark:text-accent",
  red: "border-alert/35 bg-alert/22 text-alert backdrop-blur-lg backdrop-saturate-200 dark:border-alert/40 dark:bg-alert/14",
  muted:
    "border-white/50 bg-white/[0.32] text-muted backdrop-blur-lg backdrop-saturate-200 dark:border-white/[0.16] dark:bg-slate-900/[0.4] dark:text-muted",
} as const;

export function Badge({
  className,
  tone = "blue",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
