"use client";

import { cn } from "@/lib/cn";
import type { LeaderboardRow } from "@/lib/gamification/leaderboard";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

function RankBadge({ rank }: { rank: number }) {
  const tone =
    rank === 1
      ? "bg-amber-400/25 text-amber-700 ring-amber-400/40 dark:text-amber-200"
      : rank === 2
        ? "bg-slate-300/30 text-slate-700 ring-slate-400/35 dark:text-slate-200"
        : rank === 3
          ? "bg-orange-400/20 text-orange-800 ring-orange-400/35 dark:text-orange-200"
          : "bg-white/40 text-muted ring-white/30 dark:bg-white/10";
  return (
    <span
      className={cn(
        "inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg px-2 text-sm font-bold tabular-nums ring-1",
        tone,
      )}
    >
      #{rank}
    </span>
  );
}

export function LeaderboardTable({
  topRows,
  userOutsideTop,
}: {
  topRows: LeaderboardRow[];
  userOutsideTop: LeaderboardRow | null;
}) {
  const userAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userOutsideTop && userAnchorRef.current) {
      userAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [userOutsideTop]);

  const Row = ({
    row,
    highlight,
  }: {
    row: LeaderboardRow;
    highlight?: boolean;
  }) => (
    <motion.div
      layout
      className={cn(
        "grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors md:gap-4 md:px-4",
        highlight
          ? "border-primary/40 bg-primary/10 shadow-[0_0_24px_-8px_rgba(56,189,248,0.45)] dark:bg-primary/15"
          : "border-white/40 bg-white/30 dark:border-white/10 dark:bg-slate-900/40",
      )}
    >
      <RankBadge rank={row.rank} />
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white/50 dark:ring-white/15">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={row.avatarUrl}
            alt=""
            width={40}
            height={40}
            className="h-full w-full object-cover"
          />
        </div>
        <span
          className={cn(
            "truncate font-medium",
            row.isCurrentUser ? "text-primary dark:text-cyan-200" : "text-text",
          )}
        >
          {row.name}
          {row.isCurrentUser ? (
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-primary dark:text-cyan-300">
              You
            </span>
          ) : null}
        </span>
      </div>
      <span className="hidden text-right tabular-nums text-muted sm:block">
        {row.totalFocusScore.toLocaleString()}
      </span>
      <span className="hidden text-right tabular-nums text-muted md:block">
        {row.streakDays}d
      </span>
      <span className="hidden text-right tabular-nums text-muted lg:block">
        {row.studyHours}h
      </span>
      <span className="text-right text-xs font-semibold tabular-nums text-text">
        {row.focusAccuracy}%
      </span>
    </motion.div>
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted md:gap-4 md:px-4">
        <span className="w-14">Rank</span>
        <span>Student</span>
        <span className="hidden text-right sm:block">Pts</span>
        <span className="hidden text-right md:block">Streak</span>
        <span className="hidden text-right lg:block">Hours</span>
        <span className="text-right">Acc.</span>
      </div>
      {topRows.map((row) => (
        <Row key={row.id} row={row} highlight={row.isCurrentUser} />
      ))}

      {userOutsideTop ? (
        <>
          <div className="flex items-center gap-2 py-2 text-xs text-muted">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10" />
            <span>Your position</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10" />
          </div>
          <div ref={userAnchorRef}>
            <Row row={userOutsideTop} highlight />
          </div>
        </>
      ) : null}

    </div>
  );
}
