import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

export function Card({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: "default" | "auth" }) {
  return (
    <div
      className={cn(
        variant === "auth"
          ? "rounded-[22px] p-5 transition duration-300 ease-out hover:-translate-y-0.5"
          : [
              "glass-card p-5 transition duration-300 ease-out",
              "hover:-translate-y-0.5 hover:border-white/85 hover:bg-[var(--cc-fill-hover)] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.92)_inset,0_0_0_1px_rgba(15,23,42,0.07),0_32px_80px_-22px_rgba(15,23,42,0.12)]",
              "dark:hover:border-white/[0.15] dark:hover:bg-[var(--cc-fill-hover)] dark:hover:shadow-[0_1px_0_0_rgba(255,255,255,0.24)_inset,0_0_0_1px_rgba(0,0,0,0.5),0_44px_96px_-26px_rgba(0,0,0,0.58)]",
            ],
        className,
      )}
      {...props}
    />
  );
}
