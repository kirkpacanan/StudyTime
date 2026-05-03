import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "glass-input w-full rounded-xl border px-3 py-2.5 text-sm text-text transition duration-200 placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25",
        className,
      )}
      {...props}
    />
  );
}
