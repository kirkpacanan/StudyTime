"use client";

import type { FriendRelationship } from "@/lib/social/types";
import { cn } from "@/lib/cn";

const LABELS: Partial<Record<FriendRelationship, string>> = {
  friend: "Friends",
  pending_in: "Request received",
  pending_out: "Request sent",
  blocked: "Blocked",
  blocked_by: "Unavailable",
};

const STYLES: Partial<Record<FriendRelationship, string>> = {
  friend: "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  pending_in: "border-sky-400/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  pending_out: "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  blocked: "border-alert/30 bg-alert/10 text-alert",
  blocked_by: "border-white/30 bg-white/20 text-muted",
};

export function RelationshipBadge({
  relationship,
  className,
}: {
  relationship: FriendRelationship;
  className?: string;
}) {
  const label = LABELS[relationship];
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg border px-2 py-0.5 text-[10px] font-semibold",
        STYLES[relationship],
        className,
      )}
    >
      {label}
    </span>
  );
}
