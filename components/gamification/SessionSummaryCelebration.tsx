"use client";

import { RankChip } from "@/components/gamification/RankChip";
import { Button } from "@/components/ui/button";
import { ModalBackdrop, ModalRoot } from "@/components/ui/modal-portal";
import { cn } from "@/lib/cn";
import type { SessionCelebrationPayload } from "@/lib/gamification/session-celebration";
import { playCelebrationChime } from "@/lib/gamification/sounds";
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
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { ConfettiBurst } from "./ConfettiBurst";

const APP_EASE = [0.16, 1, 0.3, 1] as const;

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
  celebrationPending?: boolean;
  saveError?: string | null;
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
  open = true,
  summary,
  celebration,
  userName,
  userAvatarSeed,
  onClose,
}: {
  open?: boolean;
  summary: SummaryBase;
  celebration: SessionCelebrationPayload | null;
  userName: string;
  userAvatarSeed: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [shareBusy, setShareBusy] = useState(false);
  const showParty = Boolean(celebration);
  const saving = Boolean(summary.celebrationPending);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (open && showParty) playCelebrationChime();
  }, [open, showParty]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
        {open ? (
          <motion.div
            key="session-summary-overlay"
            className="fixed inset-0 z-[100] flex min-h-[100dvh] w-full items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <ModalBackdrop label="Close session summary" onClick={onClose} />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="session-summary-title"
              className="glass-card relative z-10 flex max-h-[min(92dvh,820px)] w-full max-w-lg flex-col overflow-hidden p-0"
              initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.28, ease: APP_EASE }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={cn(
                  "h-1 w-full shrink-0 bg-gradient-to-r",
                  showParty
                    ? "from-emerald-400 via-sky-400 to-emerald-500"
                    : "from-primary via-sky-500 to-primary",
                )}
              />
              <ConfettiBurst active={showParty} />

              <div className="relative z-[1] flex shrink-0 items-start justify-between gap-4 border-b border-[var(--cc-border)] px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
                      showParty
                        ? "bg-emerald-500/15 ring-emerald-400/25"
                        : "bg-primary-soft ring-primary/20",
                    )}
                  >
                    {showParty ? (
                      <Trophy className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <BookOpen className="h-5 w-5 text-primary" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h2
                      id="session-summary-title"
                      className="text-base font-semibold tracking-tight text-text sm:text-lg"
                    >
                      Session complete
                    </h2>
                    <p className="mt-0.5 text-sm text-muted">{headerSubtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-white/40 hover:text-text dark:hover:bg-white/10"
                  aria-label="Close session summary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
                {summary.saveError ? (
                  <p
                    className="mb-4 rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert"
                    role="alert"
                  >
                    {summary.saveError}
                  </p>
                ) : null}

                {saving ? (
                  <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-[var(--cc-border)] bg-white/5 px-4 py-3 text-sm text-muted">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    Saving session…
                  </div>
                ) : null}

                {showParty ? (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: APP_EASE, delay: 0.05 }}
                    className="space-y-5"
                  >
                    <div className="glass-card border-emerald-400/30 bg-emerald-500/10 px-5 py-5 text-center">
                      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
                        <Sparkles className="h-7 w-7 text-emerald-500" />
                      </div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                        Focus points earned
                      </p>
                      <p className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight text-text sm:text-4xl">
                        +{celebration!.pointsEarned.toLocaleString()}
                      </p>
                      <p className="mt-1.5 text-sm text-muted">
                        Lifetime total{" "}
                        <span className="font-semibold tabular-nums text-text">
                          {celebration!.totalFocusPoints.toLocaleString()}
                        </span>{" "}
                        pts
                      </p>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <StatChip
                        icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
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
                        icon={<Trophy className="h-4 w-4 text-amber-500" />}
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
                        icon={<Flame className="h-4 w-4 text-orange-500" />}
                        label="Streak"
                        value={`${celebration!.streakDays} days`}
                      />
                      <StatChip
                        icon={<Target className="h-4 w-4 text-primary" />}
                        label="Focus accuracy"
                        value={`${summary.focusedRatio}%`}
                      />
                    </div>

                    {celebration!.progression ? (
                      <ProgressionPanel progression={celebration!.progression} />
                    ) : null}

                    {celebration!.newlyUnlocked.length > 0 ? (
                      <div className="glass-card border-amber-400/30 bg-amber-500/10 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          New achievements
                        </p>
                        <ul className="mt-3 space-y-2.5">
                          {celebration!.newlyUnlocked.map((a) => (
                            <li
                              key={a.id}
                              className="flex items-start gap-2.5 text-sm text-text"
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-400/25">
                                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                              </span>
                              <span>
                                <span className="font-semibold">{a.title}</span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                                  {a.description}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={shareBusy}
                        onClick={() => void handleSharePng()}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        {shareBusy ? "…" : "Save PNG"}
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        disabled={shareBusy}
                        onClick={() => void handleSharePng()}
                        className="gap-2"
                      >
                        <Share2 className="h-4 w-4" />
                        Share card
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="gap-2"
                        onClick={() => {
                          onClose();
                          router.push("/leaderboard");
                        }}
                      >
                        <Link2 className="h-4 w-4" />
                        Leaderboard
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {!summary.saved && !summary.saveError && !saving ? (
                      <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-4 text-sm leading-relaxed text-muted">
                        {summary.sampleCount > 0
                          ? "Your session could not be saved. Try again or check your connection."
                          : "Nothing was saved — enable the camera and study for a bit to earn points and ranks."}
                      </div>
                    ) : null}
                  </div>
                )}

                {summary.saved ? (
                  <div className={cn("grid grid-cols-2 gap-2.5", showParty && "mt-5")}>
                    <SessionMetric
                      icon={<Target className="h-3.5 w-3.5 text-primary" />}
                      label="Avg focus"
                      value={
                        summary.sampleCount > 0 ? `${summary.averageFocus}%` : "—"
                      }
                    />
                    <SessionMetric
                      icon={<Clock className="h-3.5 w-3.5 text-emerald-500" />}
                      label="≥ threshold"
                      value={
                        summary.sampleCount > 0 ? `${summary.focusedRatio}%` : "—"
                      }
                    />
                    <SessionMetric
                      icon={<BookOpen className="h-3.5 w-3.5 text-amber-500" />}
                      label="Focus time"
                      value={fmtDuration(summary.focusMs)}
                    />
                    <SessionMetric
                      icon={<Zap className="h-3.5 w-3.5 text-fuchsia-500" />}
                      label="Distractions"
                      value={String(summary.distractionEvents)}
                    />
                  </div>
                ) : null}
              </div>

              <div className="relative z-[1] flex shrink-0 gap-2.5 border-t border-[var(--cc-border)] px-5 py-4">
                <Button type="button" variant="primary" className="flex-1 gap-2" onClick={onClose}>
                  <CheckCircle2 className="h-4 w-4" />
                  Done
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    onClose();
                    router.push("/dashboard");
                  }}
                >
                  Dashboard
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalRoot>
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
    <div className="glass-card p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-text">
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
    <div className="glass-card border-amber-400/30 bg-amber-500/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          <Zap className="h-4 w-4" />
          +{p.xpEarned.toLocaleString()} XP
        </p>
        <RankChip rank={p.rank} level={p.newLevel} prestige={p.prestige} />
      </div>

      <ul className="mt-3 space-y-1 text-[11px] text-muted">
        {p.xpItems.map((item) => (
          <li key={item.key} className="flex justify-between gap-3">
            <span>{item.label}</span>
            <span className="shrink-0 tabular-nums text-text">
              +{item.amount.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>Level {p.progress.level}</span>
          <span className="tabular-nums text-text">
            {p.progress.isMaxLevel
              ? "MAX"
              : `${p.progress.xpIntoLevel.toLocaleString()} / ${p.progress.xpForThisLevel.toLocaleString()}`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/40 ring-1 ring-[var(--cc-border)] dark:bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${p.progress.percent}%` }}
            transition={{ duration: 0.8, ease: APP_EASE }}
          />
        </div>
      </div>

      {p.leveledUp ? (
        <motion.p
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-300"
        >
          <ArrowUpRight className="h-4 w-4" />
          Level up! {p.oldLevel} → {p.newLevel}
        </motion.p>
      ) : null}

      {p.rankUp ? (
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-100">
          New rank unlocked: {p.rank.title}!
        </div>
      ) : null}

      {p.completedQuests.length > 0 ? (
        <div className="mt-3 space-y-1">
          {p.completedQuests.map((q) => (
            <p
              key={q.id}
              className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-300"
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
              className="flex items-center gap-1.5 text-xs text-fuchsia-600 dark:text-fuchsia-300"
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
    <div className="glass-card p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums text-text">{value}</p>
      {sub ? (
        <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {sub}
        </p>
      ) : null}
    </div>
  );
}
