import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "glass-button-primary focus-visible:ring-primary",
  secondary: "glass-button-secondary focus-visible:ring-primary",
  ghost: "glass-button-ghost focus-visible:ring-primary",
  danger: "glass-button-danger focus-visible:ring-alert",
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
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-bg",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
