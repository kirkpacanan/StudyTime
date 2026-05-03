import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

const tones = {
  blue: "bg-primary-soft text-primary border-primary/20",
  green: "bg-success/15 text-success border-success/25",
  yellow: "bg-accent/20 text-text border-accent/35",
  red: "bg-alert/15 text-alert border-alert/25",
  muted: "bg-bg text-muted border-primary/10",
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
