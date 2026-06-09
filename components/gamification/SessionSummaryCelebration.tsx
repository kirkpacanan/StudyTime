"use client";

import { RankChip } from "@/components/gamification/RankChip";
import {
  LibraryIconButton,
  LibraryPanelHeader,
} from "@/components/library/SessionChrome";
import { ModalRoot } from "@/components/ui/modal-portal";
import { cn } from "@/lib/cn";
import type { SessionCelebrationPayload } from "@/lib/gamification/session-celebration";
import { playCelebrationChime } from "@/lib/gamification/sounds";
import { SESSION_EASE } from "@/lib/library/session-motion";
import { renderShareCardPng } from "@/lib/share-card";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock,
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

function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtTimeRange(startedAt: string, endedAt: string): string {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const sameDay = start.toDateString() === end.toDateString();
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) {
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${timeFmt(start)} – ${timeFmt(end)}`;
  }
  return `${start.toLocaleString()} → ${end.toLocaleTimeString()}`;
}

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
  const reduce = useReducedMotion();

  useEffect(() => {
    if (showParty) playCelebrationChime();
  }, [showParty]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          /* cancelled or unsupported */
        }
      }
    } finally {
      setShareBusy(false);
    }
  };

  const headerSubtitle = summary.saved
    ? `${fmtDuration(summary.focusMs)} focused · ${summary.pomodoroBlocks} block${summary.pomodoroBlocks === 1 ? "" : "s"}`
    : fmtTimeRange(summary.startedAt, summary.endedAt);

  return (
    <ModalRoot>
      <AnimatePresence>
        <motion.div
          key="session-summary-overlay"
          className="fixed inset-0 z-[200] isolate flex items-center justify-center bg-black/50 p-4 pt-16 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: SESSION_EASE }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-summary-title"
            className="library-glass-modal relative flex max-h-[min(92dvh,820px)] w-full max-w-lg flex-col"
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.32, ease: SESSION_EASE }}
          >
            <div
              className={cn(
                "h-1 shrink-0 bg-gradient-to-r",
                showParty
                  ? "from-emerald-400 via-sky-400 to-emerald-500"
                  : "from-sky-400 via-cyan-400 to-sky-500",
              )}
            />
            <ConfettiBurst active={showParty} />

            <LibraryPanelHeader
              icon={
                showParty ? (
                  <Trophy className="h-4 w-4 shrink-0 text-emerald-300" />
                ) : (
                  <BookOpen className="h-4 w-4 shrink-0 text-sky-300" />
                )
              }
              title="Session complete"
              subtitle={headerSubtitle}
              actions={
                <LibraryIconButton label="Close summary" onClick={onClose}>
                  <X className="h-3.5 w-3.5" />
                </LibraryIconButton>
              }
            />

            <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              {showParty ? (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: SESSION_EASE, delay: 0.06 }}
                  className="space-y-5"
                >
                  <div className="library-glass-panel border-emerald-500/20 px-5 py-5 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
                      <Sparkles className="h-7 w-7 text-emerald-300" />
                    </div>
                    <p className="library-text-label text-emerald-200/80">
                      Focus points earned
                    </p>
                    <h2
                      id="session-summary-title"
                      className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight text-slate-50 sm:text-4xl"
                    >
                      +{celebration!.pointsEarned.toLocaleString()}
                    </h2>
                    <p className="mt-1.5 text-sm text-slate-300">
                      Lifetime total{" "}
                      <span className="font-semibold tabular-nums text-slate-100">
                        {celebration!.totalFocusPoints.toLocaleString()}
                      </span>{" "}
                      pts
                    </p>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
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
                      icon={<Target className="h-4 w-4 text-sky-400" />}
                      label="Focus accuracy"
                      value={`${summary.focusedRatio}%`}
                    />
                  </div>

                  {celebration!.progression ? (
                    <ProgressionPanel progression={celebration!.progression} />
                  ) : null}

                  {celebration!.newlyUnlocked.length > 0 ? (
                    <div className="library-glass-panel border-amber-500/20 p-4">
                      <p className="library-text-label text-amber-200/80">
                        New achievements
                      </p>
                      <ul className="mt-3 space-y-2.5">
                        {celebration!.newlyUnlocked.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-start gap-2.5 text-sm text-slate-100"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-400/25">
                              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                            </span>
                            <span>
                              <span className="font-semibold">{a.title}</span>
                              <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                                {a.description}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <ShareActionButton
                      disabled={shareBusy}
                      onClick={() => void handleSharePng()}
                      icon={<Download className="h-4 w-4" />}
                      label={shareBusy ? "…" : "Save PNG"}
                    />
                    <ShareActionButton
                      disabled={shareBusy}
                      onClick={() => void handleSharePng()}
                      icon={<Share2 className="h-4 w-4" />}
                      label="Share card"
                      accent
                    />
                    <Link
                      href="/leaderboard"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                    >
                      <Link2 className="h-4 w-4" />
                      Leaderboard
                    </Link>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <h2
                      id="session-summary-title"
                      className="text-lg font-semibold text-slate-50"
                    >
                      Session summary
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {fmtTimeRange(summary.startedAt, summary.endedAt)}
                    </p>
                  </div>
                  {!summary.saved ? (
                    <div className="library-glass-panel border-amber-500/20 px-4 py-4 text-sm leading-relaxed text-slate-300">
                      Nothing was saved — enable the camera and complete a focus
                      block to earn points and ranks.
                    </div>
                  ) : null}
                </div>
              )}

              {summary.saved ? (
                <div className={cn("grid grid-cols-2 gap-2.5", showParty && "mt-5")}>
                  <SessionMetric
                    icon={<Target className="h-3.5 w-3.5 text-sky-400" />}
                    label="Avg focus"
                    value={
                      summary.sampleCount > 0 ? `${summary.averageFocus}%` : "—"
                    }
                  />
                  <SessionMetric
                    icon={<Clock className="h-3.5 w-3.5 text-emerald-400" />}
                    label="≥ threshold"
                    value={
                      summary.sampleCount > 0 ? `${summary.focusedRatio}%` : "—"
                    }
                  />
                  <SessionMetric
                    icon={<BookOpen className="h-3.5 w-3.5 text-amber-400" />}
                    label="Focus time"
                    value={fmtDuration(summary.focusMs)}
                  />
                  <SessionMetric
                    icon={<Zap className="h-3.5 w-3.5 text-fuchsia-400" />}
                    label="Distractions"
                    value={String(summary.distractionEvents)}
                  />
                </div>
              ) : null}
            </div>

            <div className="library-glass-footer flex shrink-0 items-center gap-2.5 border-t border-white/[0.06] px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/40 transition duration-200 hover:bg-sky-500 active:scale-[0.98]"
              >
                <CheckCircle2 className="h-4 w-4" />
                Done
              </button>
              <Link
                href="/dashboard"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              >
                Dashboard
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </ModalRoot>
  );
}

function ShareActionButton({
  icon,
  label,
  onClick,
  disabled,
  accent,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition duration-200 active:scale-[0.98] disabled:opacity-60",
        accent
          ? "border-sky-400/30 bg-sky-500/15 text-sky-100 hover:border-sky-400/50 hover:bg-sky-500/25"
          : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.08] hover:text-white",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SessionMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="library-glass-panel px-3 py-2.5">
      <div className="flex items-center gap-1.5 library-text-label normal-case tracking-normal text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-slate-50">
        {value}
      </p>
    </div>
  );
}

function ProgressionPanel({
  progression: p,
}: {
  progression: NonNullable<SessionCelebrationPayload["progression"]>;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="library-glass-panel border-amber-500/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 library-text-label text-amber-200/90">
          <Zap className="h-4 w-4" />
          +{p.xpEarned.toLocaleString()} XP
        </p>
        <RankChip rank={p.rank} level={p.newLevel} prestige={p.prestige} />
      </div>

      <ul className="mt-3 space-y-1 text-[11px] text-slate-300">
        {p.xpItems.map((item) => (
          <li key={item.key} className="flex justify-between gap-3">
            <span>{item.label}</span>
            <span className="shrink-0 tabular-nums text-slate-200">
              +{item.amount.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-300">
          <span>Level {p.progress.level}</span>
          <span className="tabular-nums">
            {p.progress.isMaxLevel
              ? "MAX"
              : `${p.progress.xpIntoLevel.toLocaleString()} / ${p.progress.xpForThisLevel.toLocaleString()}`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${p.progress.percent}%` }}
            transition={{ duration: 0.8, ease: SESSION_EASE }}
          />
        </div>
      </div>

      {p.leveledUp ? (
        <motion.p
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-amber-200"
        >
          <ArrowUpRight className="h-4 w-4" />
          Level up! {p.oldLevel} → {p.newLevel}
        </motion.p>
      ) : null}

      {p.rankUp ? (
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100">
          New rank unlocked: {p.rank.title}!
        </div>
      ) : null}

      {p.completedQuests.length > 0 ? (
        <div className="mt-3 space-y-1">
          {p.completedQuests.map((q) => (
            <p
              key={q.id}
              className="flex items-center gap-1.5 text-xs text-emerald-300"
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Quest complete: {q.title} (+{q.rewardXp} XP)
            </p>
          ))}
        </div>
      ) : null}

      {p.grantedCosmetics.length > 0 ? (
        <div className="mt-2 space-y-1">
          {p.grantedCosmetics.map((c) => (
            <p
              key={c.id}
              className="flex items-center gap-1.5 text-xs text-fuchsia-300"
            >
              <Gift className="h-3.5 w-3.5 shrink-0" />
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
    <div className="library-glass-panel px-3.5 py-3">
      <div className="flex items-center gap-1.5 library-text-label normal-case tracking-normal text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-50">{value}</p>
      {sub ? (
        <p className="mt-0.5 text-xs font-medium text-emerald-400">{sub}</p>
      ) : null}
    </div>
  );
}
