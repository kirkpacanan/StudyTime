"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModalBackdrop, ModalPortal } from "@/components/ui/modal-portal";
import { playCelebrationChime } from "@/lib/gamification/sounds";
import type { SessionCelebrationPayload } from "@/lib/gamification/session-celebration";
import { RankChip } from "@/components/gamification/RankChip";
import { renderShareCardPng } from "@/lib/share-card";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  Flame,
  Gift,
  Link2,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { ConfettiBurst } from "./ConfettiBurst";

type SummaryBase = {
  startedAt: string;
  endedAt: string;
  focusMs: number;
  breakMs: number;
  pomodoroBlocks: number;
  sampleCount: number;
  averageFocus: number;
  focusedRatio: number;
  distractionEvents: number;
  saved: boolean;
};

export function SessionSummaryCelebration({
  summary,
  celebration,
  userName,
  userAvatarSeed,
  onClose,
}: {
  summary: SummaryBase;
  celebration: SessionCelebrationPayload | null;
  userName: string;
  userAvatarSeed: string;
  onClose: () => void;
}) {
  const [shareBusy, setShareBusy] = useState(false);
  const showParty = Boolean(celebration);

  useEffect(() => {
    if (showParty) playCelebrationChime();
  }, [showParty]);

  const handleSharePng = async () => {
    if (!celebration) return;
    setShareBusy(true);
    try {
      const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userAvatarSeed)}`;
      const blob = await renderShareCardPng({
        userName,
        avatarUrl,
        focusScore: summary.averageFocus,
        studyMinutes: Math.round(summary.focusMs / 60_000),
        monthlyRank: celebration.monthlyRank,
        streakDays: celebration.streakDays,
        badges: celebration.newlyUnlocked.map((a) => a.title),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `studytime-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);

      const file = new File([blob], "studytime-session.png", {
        type: "image/png",
      });
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: "StudyTime session",
            text: `Focused ${summary.averageFocus}% — StudyTime`,
            files: [file],
          });
        } catch {
          // cancelled or unsupported files payload
        }
      }
    } finally {
      setShareBusy(false);
    }
  };

  return (
    <ModalPortal className="p-4">
      <ModalBackdrop label="Close summary" onClick={onClose} />
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-summary-title"
        className="relative z-10 max-h-[min(92vh,880px)] w-full max-w-lg overflow-hidden shadow-2xl ring-1 ring-cyan-500/20 dark:ring-cyan-400/15"
      >
        <ConfettiBurst active={showParty} />
        <button
          type="button"
          className="absolute right-3 top-3 z-20 rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white dark:text-slate-400 dark:hover:text-white"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
        <div className="relative z-[1] max-h-[inherit] overflow-y-auto">
          <div
            className={
              showParty
                ? "relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950/90 to-slate-950 px-5 py-8 text-white sm:px-8"
                : "relative px-5 py-6 sm:px-6"
            }
          >
            {showParty ? (
              <>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.15),transparent_55%)]" />
                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 22, stiffness: 280 }}
                  className="relative text-center"
                >
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/20 ring-2 ring-cyan-400/40">
                    <Sparkles className="h-9 w-9 text-cyan-300" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
                    Session complete
                  </p>
                  <h2
                    id="session-summary-title"
                    className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
                  >
                    +{celebration!.pointsEarned}{" "}
                    <span className="text-lg font-semibold text-cyan-100/90">
                      focus pts
                    </span>
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Lifetime total{" "}
                    <span className="font-semibold text-white tabular-nums">
                      {celebration!.totalFocusPoints.toLocaleString()}
                    </span>{" "}
                    pts
                  </p>
                </motion.div>

                <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
                  <StatChip
                    icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
                    label="Monthly rank"
                    value={
                      celebration!.monthlyRank != null
                        ? `#${celebration!.monthlyRank}`
                        : "—"
                    }
                    sub={
                      celebration!.monthlyRankDelta != null &&
                      celebration!.monthlyRankDelta !== 0
                        ? celebration!.monthlyRankDelta! > 0
                          ? `↑ ${celebration!.monthlyRankDelta} places`
                          : `↓ ${Math.abs(celebration!.monthlyRankDelta!)} places`
                        : undefined
                    }
                  />
                  <StatChip
                    icon={<Trophy className="h-4 w-4 text-amber-400" />}
                    label="All-time rank"
                    value={
                      celebration!.allTimeRank != null
                        ? `#${celebration!.allTimeRank}`
                        : "—"
                    }
                    sub={
                      celebration!.allTimeRankDelta != null &&
                      celebration!.allTimeRankDelta !== 0
                        ? celebration!.allTimeRankDelta! > 0
                          ? `↑ ${celebration!.allTimeRankDelta}`
                          : `↓ ${Math.abs(celebration!.allTimeRankDelta!)}`
                        : undefined
                    }
                  />
                  <StatChip
                    icon={<Flame className="h-4 w-4 text-orange-400" />}
                    label="Streak"
                    value={`${celebration!.streakDays} days`}
                  />
                  <StatChip
                    icon={<Target className="h-4 w-4 text-cyan-400" />}
                    label="Focus accuracy"
                    value={`${summary.focusedRatio}%`}
                  />
                </div>

                {celebration!.progression ? (
                  <ProgressionPanel progression={celebration!.progression} />
                ) : null}

                {celebration!.newlyUnlocked.length > 0 ? (
                  <div className="relative mt-5 rounded-xl border border-cyan-500/25 bg-black/25 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-200/80">
                      New achievements
                    </p>
                    <ul className="mt-2 space-y-2">
                      {celebration!.newlyUnlocked.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-start gap-2 text-sm text-slate-100"
                        >
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                          <span>
                            <span className="font-semibold">{a.title}</span>
                            <span className="block text-xs text-slate-400">
                              {a.description}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="relative mt-6 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2 bg-white/10 text-white hover:bg-white/15"
                    disabled={shareBusy}
                    onClick={() => void handleSharePng()}
                  >
                    {shareBusy ? (
                      "…"
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Save PNG
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2 bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30"
                    disabled={shareBusy}
                    onClick={() => void handleSharePng()}
                  >
                    <Share2 className="h-4 w-4" />
                    Share card
                  </Button>
                  <Link
                    href="/leaderboard"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
                  >
                    <Link2 className="h-4 w-4" />
                    Leaderboard
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-center">
                <h2
                  id="session-summary-title"
                  className="text-lg font-semibold text-text"
                >
                  Session summary
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {new Date(summary.startedAt).toLocaleString()} →{" "}
                  {new Date(summary.endedAt).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 bg-white/95 px-5 py-5 dark:border-white/10 dark:bg-slate-950/95 sm:px-6">
            {!summary.saved ? (
              <p className="text-sm text-muted">
                Nothing was saved — enable the camera and complete a focus block
                to earn points and ranks.
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    Avg focus
                  </dt>
                  <dd className="font-semibold tabular-nums text-text">
                    {summary.sampleCount > 0 ? `${summary.averageFocus}%` : "—"}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    ≥ threshold
                  </dt>
                  <dd className="font-semibold tabular-nums text-text">
                    {summary.sampleCount > 0 ? `${summary.focusedRatio}%` : "—"}
                  </dd>
                </div>
              </dl>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={onClose}>
                Done
              </Button>
              <Link href="/dashboard">
                <Button type="button" variant="secondary">
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </ModalPortal>
  );
}

function ProgressionPanel({
  progression: p,
}: {
  progression: NonNullable<SessionCelebrationPayload["progression"]>;
}) {
  return (
    <div className="relative mt-5 space-y-3 rounded-xl border border-amber-400/25 bg-black/25 p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200/90">
          <Zap className="h-4 w-4" />
          +{p.xpEarned.toLocaleString()} XP
        </p>
        <RankChip rank={p.rank} level={p.newLevel} prestige={p.prestige} />
      </div>

      {/* XP breakdown */}
      <ul className="space-y-0.5 text-[11px] text-slate-300">
        {p.xpItems.map((item) => (
          <li key={item.key} className="flex justify-between">
            <span>{item.label}</span>
            <span className="tabular-nums text-slate-200">
              +{item.amount.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>

      {/* Level bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-slate-300">
          <span>Level {p.progress.level}</span>
          <span className="tabular-nums">
            {p.progress.isMaxLevel
              ? "MAX"
              : `${p.progress.xpIntoLevel.toLocaleString()} / ${p.progress.xpForThisLevel.toLocaleString()}`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
            initial={{ width: 0 }}
            animate={{ width: `${p.progress.percent}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {p.leveledUp ? (
        <motion.p
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-1.5 text-sm font-semibold text-amber-200"
        >
          <ArrowUpRight className="h-4 w-4" />
          Level up! {p.oldLevel} → {p.newLevel}
        </motion.p>
      ) : null}

      {p.rankUp ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-100">
          New rank unlocked: {p.rank.title}!
        </div>
      ) : null}

      {p.completedQuests.length > 0 ? (
        <div className="space-y-1">
          {p.completedQuests.map((q) => (
            <p
              key={q.id}
              className="flex items-center gap-1.5 text-xs text-emerald-300"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Quest complete: {q.title} (+{q.rewardXp} XP)
            </p>
          ))}
        </div>
      ) : null}

      {p.grantedCosmetics.length > 0 ? (
        <div className="space-y-1">
          {p.grantedCosmetics.map((c) => (
            <p
              key={c.id}
              className="flex items-center gap-1.5 text-xs text-fuchsia-300"
            >
              <Gift className="h-3.5 w-3.5" />
              Cosmetic unlocked: {c.name} ({c.type})
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums text-white">{value}</p>
      {sub ? <p className="text-xs font-medium text-emerald-400">{sub}</p> : null}
    </div>
  );
}
