"use client";

import { LeaderboardTable } from "@/components/gamification/LeaderboardTable";
import { achievementIcon } from "@/components/gamification/icons";
import { BuddyCard } from "@/components/gamification/BuddyCard";
import { QuestsCard } from "@/components/gamification/QuestsCard";
import { StreakCard } from "@/components/gamification/StreakCard";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useProgression } from "@/contexts/progression-context";
import { ACHIEVEMENTS, type AchievementId } from "@/lib/gamification/achievements";
import {
  peekLeaderboardCache,
  setLeaderboardCache,
  type LeaderboardCacheData,
} from "@/lib/gamification/leaderboard-cache";
import {
  buildLeaderboardFromRpcRows,
  buildLocalPooledLeaderboard,
  currentWeekStart,
  currentYearMonth,
  sliceLeaderboardForDisplay,
  type LeaderboardResult,
} from "@/lib/gamification/leaderboard";
import {
  fetchLeaderboardAllTime,
  fetchLeaderboardMonthly,
  fetchLeaderboardWeekly,
} from "@/lib/storage-supabase";
import {
  getAllSessionsLocal,
  getSessionsForUser,
  getUsers,
} from "@/lib/storage";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import type { StudySession } from "@/lib/types";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type Tab = "weekly" | "monthly" | "all";

export default function LeaderboardPage() {
  const pathname = usePathname();
  const { user, ready } = useAuth();
  const { snapshot } = useProgression();
  const loadGen = useRef(0);
  const prevAuthUserId = useRef<string | null>(null);

  const [tab, setTab] = useState<Tab>("weekly");
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [remoteLb, setRemoteLb] = useState<LeaderboardCacheData | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) prevAuthUserId.current = null;
  }, [user]);

  useLayoutEffect(() => {
    if (!pathname.startsWith("/leaderboard")) return;
    if (!user?.id || !isSupabaseEnabled()) return;

    const prev = prevAuthUserId.current;
    if (prev !== null && prev !== user.id) {
      setRemoteLb(null);
      setRemoteError(null);
    }
    prevAuthUserId.current = user.id;

    const cached = peekLeaderboardCache(user.id);
    if (cached) setRemoteLb(cached);
  }, [pathname, user?.id]);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    void getSessionsForUser(user.id)
      .then((s) => {
        if (!cancelled) setSessions(s);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!pathname.startsWith("/leaderboard")) return;
    if (!user || !isSupabaseEnabled()) {
      setRemoteLb(null);
      setRemoteError(null);
      return;
    }
    const gen = ++loadGen.current;
    let cancelled = false;
    setRemoteError(null);

    void (async () => {
      try {
        const supabase = getSupabaseBrowser();
        await supabase.auth.getSession();
        if (cancelled || gen !== loadGen.current) return;
        const ym = currentYearMonth();
        const ws = currentWeekStart();
        const [mRows, aRows, wRows] = await Promise.all([
          fetchLeaderboardMonthly(ym),
          fetchLeaderboardAllTime(),
          fetchLeaderboardWeekly(ws),
        ]);
        if (cancelled || gen !== loadGen.current) return;
        const next: LeaderboardCacheData = {
          monthly: buildLeaderboardFromRpcRows(user, mRows),
          all: buildLeaderboardFromRpcRows(user, aRows),
          weekly: buildLeaderboardFromRpcRows(user, wRows),
        };
        setLeaderboardCache(user.id, next);
        setRemoteLb(next);
      } catch (e: unknown) {
        if (cancelled || gen !== loadGen.current) return;
        const msg =
          e instanceof Error ? e.message : "Could not load leaderboard.";
        setRemoteError(msg);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.name, pathname]);

  const localResults = useMemo(() => {
    if (!user || isSupabaseEnabled()) return null;
    void sessions;
    const all = getAllSessionsLocal();
    const users = getUsers();
    const monthly = buildLocalPooledLeaderboard(
      user,
      "monthly",
      all,
      users,
      currentYearMonth(),
    );
    const allTime = buildLocalPooledLeaderboard(user, "all", all, users);
    return { monthly, all: allTime, weekly: monthly };
  }, [user, sessions]);

  // Overlay the current user's live cosmetics + XP onto their leaderboard row.
  const overlay = useMemo(() => {
    return (result: LeaderboardResult | null): LeaderboardResult | null => {
      if (!result || !snapshot) return result;
      const patch = (r: (typeof result.rows)[number]) =>
        r.isCurrentUser
          ? {
              ...r,
              level: snapshot.level,
              xp: snapshot.xp,
              prestige: snapshot.prestige,
              avatarId: snapshot.loadout.avatarId,
              frameId: snapshot.loadout.frameId,
              titleId: snapshot.loadout.titleId,
              pinnedBadges: snapshot.loadout.pinnedBadges,
            }
          : r;
      return {
        ...result,
        rows: result.rows.map(patch),
        userRow: result.userRow ? patch(result.userRow) : null,
      };
    };
  }, [snapshot]);

  const monthlyResult = isSupabaseEnabled()
    ? (remoteLb?.monthly ?? null)
    : (localResults?.monthly ?? null);
  const allResult = isSupabaseEnabled()
    ? (remoteLb?.all ?? null)
    : (localResults?.all ?? null);
  const weeklyResult = isSupabaseEnabled()
    ? (remoteLb?.weekly ?? null)
    : (localResults?.weekly ?? null);

  const active = overlay(
    tab === "monthly" ? monthlyResult : tab === "all" ? allResult : weeklyResult,
  );
  const sliced = active
    ? sliceLeaderboardForDisplay(active, 25)
    : { topRows: [], userOutsideTop: null };

  const achievements = snapshot?.achievements ?? [];

  const supabaseLeaderboardPending =
    isSupabaseEnabled() && !!user && remoteLb === null && remoteError === null;

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-[var(--text)]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <span className="text-sm font-medium">Loading…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <p className="text-lg font-semibold text-text">Sign in to compete</p>
        <p className="text-sm text-muted">
          Leaderboards rank you using saved study sessions from everyone on
          StudyTime.
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

  if (supabaseLeaderboardPending) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-[var(--text)]">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <p className="text-sm font-medium">Loading leaderboard…</p>
        <p className="max-w-xs text-center text-xs text-[var(--muted)]">
          Fetching rankings from your workspace.
        </p>
      </div>
    );
  }

  if (isSupabaseEnabled() && remoteError) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <p className="text-lg font-semibold text-text">Leaderboard unavailable</p>
        <p className="text-sm text-muted">{remoteError}</p>
        <p className="text-xs text-muted">
          If this is a new project, run the latest Supabase migrations (including
          the gamification migration with{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">
            leaderboard_weekly
          </code>
          ) and try again.
        </p>
      </div>
    );
  }

  const tabLabel: Record<Tab, string> = {
    weekly: "Weekly",
    monthly: `Monthly · ${currentYearMonth()}`,
    all: "All-time",
  };

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
          Weekly boards reset every Monday, monthly boards every calendar month.
          Climb ranks, earn XP, and show off your level, frame, and pinned badges.
        </p>
      </motion.div>

      {/* Streak + quests + buddy row */}
      <div className="grid gap-4 md:grid-cols-3">
        <StreakCard />
        <QuestsCard />
        <BuddyCard />
      </div>

      <div className="flex flex-wrap justify-center gap-2 md:justify-start">
        {(["weekly", "monthly", "all"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              tab === t
                ? "bg-primary text-white shadow-lg shadow-primary/25"
                : "bg-white/60 text-muted hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
            }`}
          >
            {tabLabel[t]}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200/80 bg-gradient-to-r from-primary/[0.06] to-transparent px-6 py-4 dark:border-white/10 dark:from-cyan-500/[0.08]">
          <h2 className="text-base font-semibold text-text">
            {tab === "weekly"
              ? "This week"
              : tab === "monthly"
                ? "This month"
                : "Hall of focus"}
          </h2>
          <p className="mt-1 text-xs text-muted">
            Your row is highlighted. Not in the top 25? We scroll you into view
            below.
          </p>
        </div>
        <div className="max-h-[min(70vh,720px)] overflow-y-auto p-4 md:p-6">
          {active ? (
            <LeaderboardTable
              topRows={sliced.topRows}
              userOutsideTop={sliced.userOutsideTop}
            />
          ) : (
            <div className="flex min-h-[20vh] items-center justify-center text-sm text-muted">
              Loading…
            </div>
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
            const Icon = achievementIcon(def.icon);
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
                      unlocked
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                        : "bg-slate-200/80 dark:bg-slate-800"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-text">{def.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{def.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] font-medium capitalize text-muted">
                        {def.category} · {def.rarity}
                      </span>
                      {unlocked ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          Unlocked
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
                          +{def.rewardXp} XP
                        </span>
                      )}
                    </div>
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
