"use client";

import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/useAuth";
import { useProgression } from "@/contexts/progression-context";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_IDS,
  type AchievementRarity,
} from "@/lib/gamification/achievements";
import {
  cosmeticUnlockLabel,
  cosmeticsByType,
  isCosmeticUnlocked,
  type CosmeticDef,
  type CosmeticType,
} from "@/lib/gamification/cosmetics";
import { RANKS, earnedRankTitles, nextRankForLevel } from "@/lib/gamification/ranks";
import { achievementIcon } from "@/components/gamification/icons";
import { PlayerAvatar } from "@/components/gamification/PlayerAvatar";
import { RankChip } from "@/components/gamification/RankChip";
import {
  PrestigeCelebration,
  PrestigeConfirmModal,
} from "@/components/gamification/PrestigeModal";
import { getSessionsForUser } from "@/lib/storage";
import {
  focusAccuracyPercent,
  totalStudyHours,
} from "@/lib/gamification/stats";
import type { StudySession } from "@/lib/types";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Lock,
  Pencil,
  Pin,
  Sparkles,
  Star,
  Target,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type CustomizeTab = "avatars" | "frames" | "themes" | "badges" | "titles";

const CUSTOMIZE_TABS: { id: CustomizeTab; label: string }[] = [
  { id: "avatars", label: "Avatars" },
  { id: "frames", label: "Frames" },
  { id: "themes", label: "Themes" },
  { id: "badges", label: "Badges" },
  { id: "titles", label: "Titles" },
];

const RARITY_STYLE: Record<AchievementRarity, string> = {
  common: "text-slate-500 border-slate-300/50 from-slate-100/60 to-slate-200/20 dark:from-slate-800/40 dark:to-slate-700/10",
  rare: "text-sky-500 border-sky-400/50 from-sky-100/60 to-sky-200/20 dark:from-sky-900/40 dark:to-sky-800/10",
  epic: "text-fuchsia-500 border-fuchsia-400/50 from-fuchsia-100/60 to-fuchsia-200/20 dark:from-fuchsia-900/40 dark:to-fuchsia-800/10",
  legendary: "text-amber-500 border-amber-400/60 from-amber-100/60 to-amber-200/20 dark:from-amber-900/40 dark:to-amber-800/10",
};

const ACHIEVEMENT_CATEGORY_LABEL: Record<string, string> = {
  focus: "Focus",
  consistency: "Consistency",
  speed: "Speed",
  social: "Social",
  seasonal: "Seasonal",
};

function formatMemberSince(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="glass-card flex flex-col gap-2 p-4">
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", accent)}>
        {icon}
      </div>
      <p className="text-2xl font-bold tabular-nums text-text">{value}</p>
      <div>
        <p className="text-xs font-semibold text-text">{label}</p>
        {sub && <p className="mt-0.5 text-[10px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const {
    snapshot,
    updateLoadout,
    equipCosmetic,
    togglePinnedBadge,
    equipTitle,
    prestige,
  } = useProgression();

  const [customizeTab, setCustomizeTab] = useState<CustomizeTab>("avatars");
  const [showCustomize, setShowCustomize] = useState(false);

  // Prestige flow
  const [showPrestigeConfirm, setShowPrestigeConfirm] = useState(false);
  const [prestigeBusy, setPrestigeBusy] = useState(false);
  const [prestigeError, setPrestigeError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationPrestige, setCelebrationPrestige] = useState(0);

  // Session stats
  const [sessions, setSessions] = useState<StudySession[]>([]);
  useEffect(() => {
    if (!user) return;
    void getSessionsForUser(user.id).then(setSessions);
  }, [user]);

  // Bio / status editing
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const bioRef = useRef<HTMLTextAreaElement>(null);

  const openBioEdit = () => {
    setBioDraft(snapshot?.loadout.bio ?? "");
    setStatusDraft(snapshot?.loadout.status ?? "Locked in");
    setEditingBio(true);
    setTimeout(() => bioRef.current?.focus(), 50);
  };

  const saveBio = async () => {
    await updateLoadout({
      bio: bioDraft.trim(),
      status: statusDraft.trim() || "Locked in",
    });
    setEditingBio(false);
  };

  const cancelBio = () => setEditingBio(false);

  if (!user || !snapshot) return null;

  const name = user.name || "Student";
  const seed = user.id + name;
  const {
    loadout,
    ownedCosmetics,
    achievements,
    progress,
    rank,
    prestige: prestigeLevel,
    streak,
    xp,
    xpForNextRank,
  } = snapshot;

  const displayRank = loadout.titleId
    ? (RANKS.find((r) => r.slug === loadout.titleId) ?? rank)
    : rank;
  const ownedSet = new Set(ownedCosmetics);
  const canPrestige = progress.level >= 50;

  // Computed stats
  const studyHours = totalStudyHours(sessions);
  const accuracy = focusAccuracyPercent(sessions);
  const nextRank = nextRankForLevel(progress.level);
  const xpToNextRank =
    xpForNextRank != null ? Math.max(0, xpForNextRank - xp) : null;

  const unlockedSet = new Set(achievements);
  const pinnedBadges = loadout.pinnedBadges;
  const bio = loadout.bio || "";
  const status = loadout.status || "Locked in";

  // Group achievements by category
  const achievementsByCategory = ACHIEVEMENT_IDS.reduce<
    Record<string, typeof ACHIEVEMENT_IDS>
  >((acc, id) => {
    const cat = ACHIEVEMENTS[id].category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(id);
    return acc;
  }, {});

  const isUnlocked = (c: CosmeticDef) =>
    ownedSet.has(c.id) || isCosmeticUnlocked(c, progress.level, prestigeLevel);

  const equippedId = (type: CosmeticType) =>
    type === "avatar"
      ? loadout.avatarId
      : type === "frame"
        ? loadout.frameId
        : loadout.themeId;

  function renderCosmeticGrid(type: CosmeticType) {
    const items = cosmeticsByType(type);
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((c) => {
          const unlocked = isUnlocked(c);
          const equipped = equippedId(type) === c.id;
          return (
            <button
              key={c.id}
              type="button"
              disabled={!unlocked}
              onClick={() => unlocked && void equipCosmetic(type, c.id)}
              className={cn(
                "group relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition",
                equipped
                  ? "border-primary/60 bg-primary/10 dark:border-cyan-400/50"
                  : "border-white/45 bg-white/30 hover:bg-white/45 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.1]",
                !unlocked && "cursor-not-allowed opacity-60",
              )}
            >
              {type === "theme" ? (
                <span
                  className={cn(
                    "h-12 w-12 rounded-full bg-gradient-to-br ring-2 ring-white/50 dark:ring-white/15",
                    (c.metadata.gradient as string) ?? "from-sky-400 to-blue-600",
                  )}
                />
              ) : type === "avatar" ? (
                <PlayerAvatar
                  avatarId={c.id}
                  frameId={loadout.frameId}
                  seed={seed}
                  size={48}
                />
              ) : (
                <PlayerAvatar
                  avatarId={loadout.avatarId}
                  frameId={c.id}
                  seed={seed}
                  size={48}
                />
              )}
              <span className="line-clamp-1 text-xs font-semibold text-text">{c.name}</span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {c.rarity}
                {c.animated ? " · animated" : ""}
              </span>
              {equipped && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="h-3 w-3" />
                </span>
              )}
              {!unlocked && (
                <span className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-md bg-black/55 py-0.5 text-[9px] font-semibold text-white">
                  <Lock className="h-2.5 w-2.5" />
                  {cosmeticUnlockLabel(c)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  function renderBadgesTab() {
    return (
      <div>
        <p className="mb-3 text-xs text-muted">
          Pin up to 3 badges to your profile ({pinnedBadges.length}/3 pinned).
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENT_IDS.map((id) => {
            const def = ACHIEVEMENTS[id];
            const Icon = achievementIcon(def.icon);
            const unlocked = unlockedSet.has(id);
            const isPinned = pinnedBadges.includes(id);
            return (
              <div
                key={id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3 py-2.5",
                  unlocked
                    ? "border-white/45 bg-white/30 dark:border-white/10 dark:bg-white/[0.05]"
                    : "border-slate-200/70 bg-slate-50/40 opacity-60 dark:border-white/10 dark:bg-slate-900/30",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br",
                    RARITY_STYLE[def.rarity],
                    def.animated && unlocked
                      ? "badge-shimmer from-amber-200 via-yellow-100 to-amber-300"
                      : "",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-text">{def.title}</p>
                  <p className="text-[10px] capitalize text-muted">
                    {def.category} · {def.rarity}
                  </p>
                </div>
                {unlocked ? (
                  <button
                    type="button"
                    onClick={() => void togglePinnedBadge(id)}
                    disabled={!isPinned && pinnedBadges.length >= 3}
                    className={cn(
                      "shrink-0 rounded-lg border p-1.5 transition",
                      isPinned
                        ? "border-amber-400/50 bg-amber-500/20 text-amber-600 dark:text-amber-300"
                        : "border-white/45 bg-white/20 text-muted hover:bg-white/40 disabled:opacity-40 dark:border-white/10",
                    )}
                    aria-label={isPinned ? "Unpin badge" : "Pin badge"}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-muted" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderTitlesTab() {
    const earned = earnedRankTitles(progress.level);
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void equipTitle(null)}
          className={cn(
            "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition",
            loadout.titleId == null
              ? "border-primary/50 bg-primary/8 dark:border-primary/30 dark:bg-primary/10"
              : "border-white/45 bg-white/30 hover:bg-white/45 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]",
          )}
        >
          <span className="font-medium text-text">Use current rank (auto)</span>
          {loadout.titleId == null && <Check className="h-4 w-4 text-primary" />}
        </button>
        {RANKS.map((r) => {
          const unlocked = earned.some((e) => e.slug === r.slug);
          const equipped = loadout.titleId === r.slug;
          return (
            <button
              key={r.slug}
              type="button"
              disabled={!unlocked}
              onClick={() => unlocked && void equipTitle(r.slug)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition",
                equipped
                  ? "border-white/55 bg-white/35 dark:border-white/15 dark:bg-white/[0.08]"
                  : "border-white/45 bg-white/30 hover:bg-white/45 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]",
                !unlocked && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="flex items-center gap-2.5">
                <RankChip rank={r} />
                <span className="text-xs text-muted">Lv {r.levelMin}+</span>
              </span>
              {equipped ? (
                <Check className="h-4 w-4 text-primary" />
              ) : !unlocked ? (
                <span className="flex items-center gap-1 text-[10px] text-muted">
                  <Lock className="h-3 w-3" />
                  Lv {r.levelMin}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  const handlePrestigeConfirm = async () => {
    setPrestigeBusy(true);
    setPrestigeError(null);
    const nextPrestige = (snapshot?.prestige ?? 0) + 1;
    const res = await prestige();
    setPrestigeBusy(false);
    if (res.ok) {
      setShowPrestigeConfirm(false);
      setCelebrationPrestige(nextPrestige);
      setShowCelebration(true);
    } else {
      setPrestigeError(res.error ?? "Something went wrong.");
    }
  };

  const handleCelebrationDismiss = useCallback(() => {
    setShowCelebration(false);
  }, []);

  return (
    <div className="space-y-5">
      {/* ── Prestige banner ── */}
      {canPrestige && (
        <div className="glass-card flex items-center justify-between gap-3 border-amber-400/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-amber-500" />
            <span className="font-medium text-text">
              Max level reached — Prestige to reset &amp; earn +10% XP.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setPrestigeError(null);
              setShowPrestigeConfirm(true);
            }}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
          >
            Prestige
          </button>
        </div>
      )}

      {/* ── Hero card ── */}
      <div className="glass-card p-5">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="shrink-0">
            <PlayerAvatar
              avatarId={loadout.avatarId}
              frameId={loadout.frameId}
              seed={seed}
              size={72}
            />
          </div>

          {/* Name + rank + bio */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-2xl font-bold text-text leading-tight">{name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <RankChip rank={displayRank} prestige={snapshot.prestige} />
                  {prestigeLevel > 0 && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                      ✦ Prestige {prestigeLevel}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={openBioEdit}
                className="shrink-0 rounded-lg border border-white/45 bg-white/30 p-2 text-muted transition hover:bg-white/50 hover:text-text dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.1]"
                aria-label="Edit bio"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Bio display / edit */}
            {editingBio ? (
              <div className="mt-3 space-y-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Bio
                  </label>
                  <textarea
                    ref={bioRef}
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value)}
                    maxLength={160}
                    rows={2}
                    placeholder="Tell people about your study style…"
                    className="w-full resize-none rounded-xl border border-white/45 bg-white/40 px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-white/15 dark:bg-white/[0.07]"
                  />
                  <p className="mt-0.5 text-right text-[10px] text-muted">
                    {bioDraft.length}/160
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Status
                  </label>
                  <input
                    type="text"
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    maxLength={60}
                    placeholder="e.g. Locked in, Grinding finals…"
                    className="w-full rounded-xl border border-white/45 bg-white/40 px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-white/15 dark:bg-white/[0.07]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveBio()}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelBio}
                    className="flex items-center gap-1.5 rounded-lg border border-white/45 bg-white/30 px-3.5 py-1.5 text-xs font-semibold text-text transition hover:bg-white/45 dark:border-white/10 dark:bg-white/[0.05]"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 space-y-1">
                {bio ? (
                  <p className="text-sm text-text/80 leading-relaxed">{bio}</p>
                ) : (
                  <p className="text-sm italic text-muted/60">No bio yet — click the pencil to add one.</p>
                )}
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_#34d399]" />
                  {status}
                </p>
              </div>
            )}

            {/* Pinned badges */}
            {pinnedBadges.length > 0 && !editingBio && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Badges
                </span>
                <div className="flex items-center gap-1.5">
                  {pinnedBadges.map((id) => {
                    const def = ACHIEVEMENTS[id];
                    const Icon = achievementIcon(def.icon);
                    return (
                      <div
                        key={id}
                        title={def.title}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg border bg-gradient-to-br",
                          RARITY_STYLE[def.rarity],
                          def.animated
                            ? "badge-shimmer from-amber-200 via-yellow-100 to-amber-300"
                            : "",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Member since */}
            <p className="mt-2.5 flex items-center gap-1 text-[11px] text-muted">
              <Calendar className="h-3 w-3" />
              Member since {formatMemberSince(user.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Clock className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
          label="Study Hours"
          value={studyHours}
          sub="Total time focused"
          accent="bg-sky-100/70 dark:bg-sky-900/40"
        />
        <StatCard
          icon={<Flame className="h-4 w-4 text-orange-500" />}
          label="Day Streak"
          value={streak.current}
          sub={streak.longest > 0 ? `Best: ${streak.longest}d` : "Keep it going!"}
          accent="bg-orange-100/70 dark:bg-orange-900/40"
        />
        <StatCard
          icon={<Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          label="Sessions"
          value={sessions.length}
          sub={`${achievements.length} achievements`}
          accent="bg-amber-100/70 dark:bg-amber-900/40"
        />
        <StatCard
          icon={<Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          label="Focus Rate"
          value={`${accuracy}%`}
          sub="Avg. weighted accuracy"
          accent="bg-emerald-100/70 dark:bg-emerald-900/40"
        />
      </div>

      {/* ── Level & XP card ── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-semibold text-text">Level {progress.level}</span>
            {progress.isMaxLevel && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                MAX
              </span>
            )}
          </div>
          <span className="tabular-nums text-xs text-muted">
            {progress.isMaxLevel
              ? "Max level reached"
              : `${progress.xpIntoLevel.toLocaleString()} / ${progress.xpForThisLevel.toLocaleString()} XP`}
          </span>
        </div>

        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full border border-white/40 bg-white/40 dark:border-white/10 dark:bg-slate-800/50">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out",
              rank.gradient,
            )}
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>
            {xp.toLocaleString()} XP total
          </span>
          {nextRank && xpToNextRank != null ? (
            <span>
              {xpToNextRank.toLocaleString()} XP to{" "}
              <span className="font-semibold text-text">{nextRank.title}</span>
            </span>
          ) : (
            <span className="font-medium text-amber-500">Top rank reached!</span>
          )}
        </div>
      </div>

      {/* ── Achievements ── */}
      <div className="glass-card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--cc-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-text">Achievements</h2>
          </div>
          <span className="rounded-full bg-white/40 px-2.5 py-0.5 text-xs font-semibold text-text dark:bg-white/[0.08]">
            {achievements.length} / {ACHIEVEMENT_IDS.length} unlocked
          </span>
        </div>

        <div className="divide-y divide-[var(--cc-border)]">
          {Object.entries(achievementsByCategory).map(([cat, ids]) => {
            const catUnlocked = ids.filter((id) => unlockedSet.has(id)).length;
            return (
              <div key={cat} className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {ACHIEVEMENT_CATEGORY_LABEL[cat] ?? cat}
                  </p>
                  <p className="text-[10px] text-muted">{catUnlocked}/{ids.length}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ids.map((id) => {
                    const def = ACHIEVEMENTS[id];
                    const Icon = achievementIcon(def.icon);
                    const unlocked = unlockedSet.has(id);
                    const isPinned = pinnedBadges.includes(id);
                    return (
                      <div
                        key={id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                          unlocked
                            ? "border-white/45 bg-white/30 dark:border-white/10 dark:bg-white/[0.05]"
                            : "border-slate-200/70 bg-slate-50/40 opacity-55 dark:border-white/10 dark:bg-slate-900/30",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br",
                            RARITY_STYLE[def.rarity],
                            def.animated && unlocked
                              ? "badge-shimmer from-amber-200 via-yellow-100 to-amber-300"
                              : "",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-text">
                            {def.title}
                          </p>
                          <p className="line-clamp-1 text-[10px] text-muted">
                            {def.description}
                          </p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {unlocked ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void togglePinnedBadge(id)}
                                disabled={!isPinned && pinnedBadges.length >= 3}
                                title={isPinned ? "Unpin" : "Pin to profile"}
                                className={cn(
                                  "rounded-lg border p-1 transition",
                                  isPinned
                                    ? "border-amber-400/50 bg-amber-500/20 text-amber-600 dark:text-amber-300"
                                    : "border-white/45 bg-white/20 text-muted hover:bg-white/40 disabled:opacity-40 dark:border-white/10",
                                )}
                              >
                                <Pin className="h-3 w-3" />
                              </button>
                              <span className="text-[9px] font-medium text-emerald-500">
                                Earned
                              </span>
                            </>
                          ) : (
                            <Lock className="h-3.5 w-3.5 text-muted" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Customize section (collapsible) ── */}
      <div className="glass-card overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setShowCustomize((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-white/10 dark:hover:bg-white/[0.04]"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-text">Customize</h2>
            <span className="text-xs text-muted">
              {ownedCosmetics.length} cosmetics owned
            </span>
          </div>
          {showCustomize ? (
            <ChevronUp className="h-4 w-4 text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted" />
          )}
        </button>

        {showCustomize && (
          <>
            <div className="flex gap-1 overflow-x-auto border-b border-[var(--cc-border)] px-3 py-2">
              {CUSTOMIZE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCustomizeTab(t.id)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                    customizeTab === t.id
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted hover:bg-white/40 hover:text-text dark:hover:bg-white/10",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-5">
              {customizeTab === "avatars" && renderCosmeticGrid("avatar")}
              {customizeTab === "frames" && renderCosmeticGrid("frame")}
              {customizeTab === "themes" && renderCosmeticGrid("theme")}
              {customizeTab === "badges" && renderBadgesTab()}
              {customizeTab === "titles" && renderTitlesTab()}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <PrestigeConfirmModal
        open={showPrestigeConfirm}
        currentPrestige={snapshot?.prestige ?? 0}
        busy={prestigeBusy}
        error={prestigeError}
        onConfirm={() => void handlePrestigeConfirm()}
        onCancel={() => !prestigeBusy && setShowPrestigeConfirm(false)}
      />
      <PrestigeCelebration
        show={showCelebration}
        newPrestige={celebrationPrestige}
        onDismiss={handleCelebrationDismiss}
      />
    </div>
  );
}
