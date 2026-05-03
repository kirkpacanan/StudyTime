import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/10 bg-surface p-5 shadow-sm transition duration-300 ease-out",
        "hover:-translate-y-0.5 hover:border-primary/18 hover:shadow-[0_12px_40px_-16px_rgba(79,134,247,0.18)]",
        className,
      )}
      {...props}
    />
  );
}
