"use client";

import { cn } from "@/lib/cn";
import type { LeaderboardRow } from "@/lib/gamification/leaderboard";
import { ACHIEVEMENTS, type AchievementId } from "@/lib/gamification/achievements";
import { rankForLevel, RANKS } from "@/lib/gamification/ranks";
import { PlayerAvatar } from "./PlayerAvatar";
import { RankChip } from "./RankChip";
import { achievementIcon } from "./icons";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef } from "react";

/** Links a leaderboard entry to the user's public profile (cloud mode only). */
function ProfileLink({
  userId,
  isCurrentUser,
  children,
}: {
  userId: string;
  isCurrentUser: boolean;
  children: React.ReactNode;
}) {
  const className = "flex min-w-0 items-center gap-3";
  if (isCurrentUser) {
    return (
      <Link href="/profile" className={className}>
        {children}
      </Link>
    );
  }
  if (!isSupabaseEnabled()) {
    return <div className={className}>{children}</div>;
  }
  return (
    <Link href={`/u/${userId}`} className={cn(className, "transition hover:opacity-80")}>
      {children}
    </Link>
  );
}

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

function PinnedBadges({ ids }: { ids: string[] }) {
  const valid = ids.filter((id): id is AchievementId => id in ACHIEVEMENTS).slice(0, 3);
  if (valid.length === 0) return null;
  return (
    <div className="hidden items-center gap-1 lg:flex">
      {valid.map((id) => {
        const def = ACHIEVEMENTS[id];
        const Icon = achievementIcon(def.icon);
        return (
          <span
            key={id}
            title={def.title}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-amber-400/40 bg-amber-500/15 text-amber-600 dark:text-amber-300"
          >
            <Icon className="h-3 w-3" />
          </span>
        );
      })}
    </div>
  );
}

function Row({
  row,
  highlight,
}: {
  row: LeaderboardRow;
  highlight?: boolean;
}) {
  const rankDef = row.titleId
    ? (RANKS.find((r) => r.slug === row.titleId) ?? rankForLevel(row.level))
    : rankForLevel(row.level);
  return (
    <motion.div
      layout
      className={cn(
        "grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors md:gap-4 md:px-4",
        highlight
          ? "border-primary/40 bg-primary/10 shadow-[0_0_24px_-8px_rgba(56,189,248,0.45)] dark:bg-primary/15"
          : "border-white/40 bg-white/30 dark:border-white/10 dark:bg-slate-900/40",
      )}
    >
      <RankBadge rank={row.rank} />
      <div className="flex min-w-0 items-center gap-3">
        <ProfileLink userId={row.id} isCurrentUser={row.isCurrentUser}>
          <PlayerAvatar
            avatarId={row.avatarId ?? undefined}
            frameId={row.frameId ?? undefined}
            seed={row.id + row.name}
            size={40}
          />
          <div className="min-w-0">
            <span
              className={cn(
                "flex items-center gap-2 truncate font-medium",
                row.isCurrentUser ? "text-primary dark:text-cyan-200" : "text-text",
              )}
            >
              <span className="truncate">{row.name}</span>
              {row.isCurrentUser ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary dark:text-cyan-300">
                  You
                </span>
              ) : null}
            </span>
            <div className="mt-0.5 flex items-center gap-2">
              <RankChip rank={rankDef} level={row.level} prestige={row.prestige} />
            </div>
          </div>
        </ProfileLink>
      </div>
      <PinnedBadges ids={row.pinnedBadges} />
      <div className="text-right">
        <p className="text-xs font-semibold tabular-nums text-text">
          {row.xp > 0
            ? `${row.xp.toLocaleString()} XP`
            : `${row.totalFocusScore.toLocaleString()} pts`}
        </p>
        <p className="text-[10px] tabular-nums text-muted">
          {row.streakDays}d · {row.focusAccuracy}%
        </p>
      </div>
    </motion.div>
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

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted md:gap-4 md:px-4">
        <span className="w-14">Rank</span>
        <span>Student</span>
        <span className="hidden text-right lg:block">Badges</span>
        <span className="text-right">XP / Streak</span>
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
