"use client";

import { LeaderboardTable } from "@/components/gamification/LeaderboardTable";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { ACHIEVEMENTS, type AchievementId } from "@/lib/gamification/achievements";
import {
  buildAllTimeLeaderboard,
  buildMonthlyLeaderboard,
  sliceLeaderboardForDisplay,
} from "@/lib/gamification/leaderboard";
import { currentYearMonth } from "@/lib/gamification/stats";
import { getUnlockedAchievements } from "@/lib/gamification/rank-storage";
import { getSessionsForUser } from "@/lib/storage";
import type { StudySession } from "@/lib/types";
import { motion } from "framer-motion";
import {
  Crown,
  Flame,
  Moon,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const ICONS = {
  target: Target,
  flame: Flame,
  trophy: Trophy,
  moon: Moon,
  zap: Zap,
  crown: Crown,
} as const;

export default function LeaderboardPage() {
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<"monthly" | "all">("monthly");
  const [sessions, setSessions] = useState<StudySession[]>([]);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    void getSessionsForUser(user.id).then((s) => {
      if (!cancelled) setSessions(s);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const monthlyResult = useMemo(() => {
    if (!user) return null;
    return buildMonthlyLeaderboard(user, sessions, currentYearMonth());
  }, [user, sessions]);

  const allResult = useMemo(() => {
    if (!user) return null;
    return buildAllTimeLeaderboard(user, sessions);
  }, [user, sessions]);

  const active = tab === "monthly" ? monthlyResult : allResult;
  const sliced = active
    ? sliceLeaderboardForDisplay(active, 25)
    : { topRows: [], userOutsideTop: null };

  const achievements = user ? getUnlockedAchievements(user.id) : [];

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <p className="text-lg font-semibold text-text">Sign in to compete</p>
        <p className="text-sm text-muted">
          Leaderboards use your saved sessions to rank you against the global
          StudyTime community (demo pool + your stats).
        </p>
        <Link
          href="/login"
          className="inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16 pt-4 md:pt-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2 text-center md:text-left"
      >
        <Badge tone="blue" className="uppercase tracking-widest">
          Rankings
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-text md:text-4xl">
          Global leaderboard
        </h1>
        <p className="max-w-xl text-sm text-muted">
          Monthly boards reset every calendar month so everyone can climb. All-time
          honors sustained excellence. Rank blends focus points, streaks, hours, and
          accuracy.
        </p>
      </motion.div>

      <div className="flex justify-center gap-2 md:justify-start">
        <button
          type="button"
          onClick={() => setTab("monthly")}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
            tab === "monthly"
              ? "bg-primary text-white shadow-lg shadow-primary/25"
              : "bg-white/60 text-muted hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
          }`}
        >
          Monthly · {currentYearMonth()}
        </button>
        <button
          type="button"
          onClick={() => setTab("all")}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
            tab === "all"
              ? "bg-primary text-white shadow-lg shadow-primary/25"
              : "bg-white/60 text-muted hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
          }`}
        >
          All-time
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200/80 bg-gradient-to-r from-primary/[0.06] to-transparent px-6 py-4 dark:border-white/10 dark:from-cyan-500/[0.08]">
          <h2 className="text-base font-semibold text-text">
            {tab === "monthly" ? "This month" : "Hall of focus"}
          </h2>
          <p className="mt-1 text-xs text-muted">
            Your row is highlighted. Not in the top 25? We scroll you into view
            below.
          </p>
        </div>
        <div className="max-h-[min(70vh,720px)] overflow-y-auto p-4 md:p-6">
          {active && (
            <LeaderboardTable
              topRows={sliced.topRows}
              userOutsideTop={sliced.userOutsideTop}
            />
          )}
        </div>
      </Card>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-text">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Your achievements
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(ACHIEVEMENTS) as AchievementId[]).map((id) => {
            const def = ACHIEVEMENTS[id];
            const Icon = ICONS[def.icon as keyof typeof ICONS];
            const unlocked = achievements.includes(id);
            return (
              <div
                key={id}
                className={`rounded-xl border px-4 py-3 transition ${
                  unlocked
                    ? "border-amber-400/35 bg-amber-500/[0.08] dark:border-amber-500/25"
                    : "border-slate-200/80 bg-slate-50/50 opacity-60 dark:border-white/10 dark:bg-slate-900/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      unlocked ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-slate-200/80 dark:bg-slate-800"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-text">{def.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{def.description}</p>
                    {unlocked ? (
                      <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        Unlocked
                      </span>
                    ) : (
                      <span className="mt-2 inline-block text-[10px] font-medium uppercase tracking-wide text-muted">
                        Locked
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}
