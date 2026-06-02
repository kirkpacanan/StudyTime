"use client";

import { cn } from "@/lib/cn";
import type { PresenceStatus } from "@/lib/social/types";

const STYLES: Record<PresenceStatus, { ring: string; label: string }> = {
  studying: { ring: "bg-emerald-500", label: "Studying now" },
  online: { ring: "bg-sky-500", label: "Online" },
  offline: { ring: "bg-slate-400 dark:bg-slate-600", label: "Offline" },
};

/** Small status dot overlaid on an avatar (bottom-right). */
export function PresenceDot({
  status,
  size = 12,
  className,
}: {
  status: PresenceStatus;
  size?: number;
  className?: string;
}) {
  const s = STYLES[status];
  return (
    <span
      title={s.label}
      aria-label={s.label}
      className={cn(
        "block rounded-full ring-2 ring-bg",
        s.ring,
        status === "studying" && "animate-pulse",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
