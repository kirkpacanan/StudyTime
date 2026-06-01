"use client";

import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/useAuth";
import { useProgression } from "@/contexts/progression-context";
import { ACHIEVEMENTS } from "@/lib/gamification/achievements";
import { RANKS, nextRankForLevel } from "@/lib/gamification/ranks";
import { achievementIcon } from "./icons";
import { PlayerAvatar } from "./PlayerAvatar";
import { RankChip } from "./RankChip";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export function ProfilePanel() {
  const { user } = useAuth();
  const { snapshot } = useProgression();

  if (!user) return null;

  const name = user.name || "Student";
  const seed = user.id + name;

  if (!snapshot) {
    return (
      <div className="border-t border-[var(--cc-border)] p-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 animate-pulse rounded-full bg-white/30 dark:bg-white/10" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-white/30 dark:bg-white/10" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-white/20 dark:bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  const { loadout, progress, rank, prestige, xp, xpForNextRank } = snapshot;
  const displayRank = loadout.titleId
    ? (RANKS.find((r) => r.slug === loadout.titleId) ?? rank)
    : rank;
  const next = nextRankForLevel(progress.level);
  const xpToNextRank =
    xpForNextRank != null ? Math.max(0, xpForNextRank - xp) : null;
  const quote = loadout.bio || loadout.status || "Locked in";
  const pinned = loadout.pinnedBadges.slice(0, 3);

  return (
    <div className="border-t border-[var(--cc-border)] p-3">
      <div className="rounded-2xl border border-white/45 bg-white/30 p-3 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05]">
        <Link
          href="/profile"
          className="flex items-start gap-3 rounded-xl transition hover:bg-white/20 dark:hover:bg-white/[0.06] -m-1 p-1"
        >
          <PlayerAvatar
            avatarId={loadout.avatarId}
            frameId={loadout.frameId}
            seed={seed}
            size={48}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text">{name}</p>
            <div className="mt-1">
              <RankChip rank={displayRank} prestige={prestige} />
            </div>
          </div>
        </Link>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted">
              <span>Level {progress.level}</span>
              <span className="tabular-nums">
                {progress.isMaxLevel
                  ? "MAX"
                  : `${progress.xpIntoLevel.toLocaleString()} / ${progress.xpForThisLevel.toLocaleString()} XP`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-white/40 bg-white/40 dark:border-white/10 dark:bg-slate-800/50">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out",
                  rank.gradient,
                )}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            {next && xpToNextRank != null ? (
              <p className="text-[10px] text-muted">
                {xpToNextRank.toLocaleString()} XP to{" "}
                <span className="font-semibold text-text">{next.title}</span>
              </p>
            ) : (
              <p className="text-[10px] text-muted">Top rank reached</p>
            )}
          </div>

          <p className="mt-2 truncate text-[11px] italic text-muted" title={quote}>
            “{quote}”
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            {[0, 1, 2].map((i) => {
              const id = pinned[i];
              const def = id ? ACHIEVEMENTS[id] : null;
              const Icon = def ? achievementIcon(def.icon) : null;
              return (
                <div
                  key={i}
                  title={def?.title ?? "Pin a badge"}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg border",
                    def
                      ? "border-amber-400/40 bg-amber-500/15 text-amber-600 dark:text-amber-300"
                      : "border-dashed border-white/40 bg-white/10 text-muted/50 dark:border-white/10",
                  )}
                >
                  {Icon ? <Icon className="h-4 w-4" /> : <Sparkles className="h-3.5 w-3.5" />}
                </div>
              );
            })}
            <Link
              href="/profile"
              className="ml-auto rounded-lg border border-white/45 bg-white/30 px-2.5 py-1.5 text-[11px] font-semibold text-text transition hover:bg-white/50 dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.12]"
            >
              View Profile
            </Link>
          </div>
        </div>
      </div>
  );
}
