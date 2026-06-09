"use client";

import { cn } from "@/lib/cn";
import type { RoomWithRole } from "@/lib/focus-hub/types";
import { motion } from "framer-motion";
import { Check, Copy, GraduationCap, Lock, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type RoomCardProps = {
  room: RoomWithRole;
};

const CATEGORY_COLORS: Record<string, string> = {
  education: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  business: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  training: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  meeting: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

export function RoomCard({ room }: RoomCardProps) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(room.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const categoryStyle =
    CATEGORY_COLORS[room.category?.toLowerCase() ?? ""] ??
    "bg-primary/15 text-primary border-primary/20";

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      <Link href={`/focus-hub/${room.id}`} className="block">
        <div className="group relative overflow-hidden rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5 transition-shadow hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/30">
          {/* Header row */}
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              {room.image_url ? (
                <img
                  src={room.image_url}
                  alt=""
                  className="h-10 w-10 rounded-xl object-cover"
                />
              ) : (
                <GraduationCap className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {room.is_private && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/20 bg-slate-400/10 px-2 py-0.5 text-[10px] font-medium text-muted">
                  <Lock className="h-2.5 w-2.5" />
                  Private
                </span>
              )}
              {room.role === "host" && (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  Host
                </span>
              )}
              {room.category && (
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                    categoryStyle,
                  )}
                >
                  {room.category}
                </span>
              )}
            </div>
          </div>

          {/* Name + description */}
          <p className="line-clamp-1 text-sm font-semibold text-text">
            {room.name}
          </p>
          {room.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted">
              {room.description}
            </p>
          )}

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted">
              <Users className="h-3.5 w-3.5" />
              <span>
                {room.memberCount} / {room.participant_limit}
              </span>
            </div>

            {/* Join code copy */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                void copyCode();
              }}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--cc-border)] bg-white/5 px-2 py-1 text-[10px] font-mono font-semibold text-muted transition hover:text-text"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {room.join_code}
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
