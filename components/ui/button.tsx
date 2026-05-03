import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary:
    "bg-primary text-white shadow-sm hover:bg-primary/90 focus-visible:ring-primary",
  secondary:
    "bg-surface text-text border border-primary/15 hover:bg-primary-soft/60 focus-visible:ring-primary",
  ghost: "text-text hover:bg-primary-soft/80 focus-visible:ring-primary",
  danger:
    "bg-alert text-white shadow-sm hover:bg-alert/90 focus-visible:ring-alert",
} as const;

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-bg",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
