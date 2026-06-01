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
import { RANKS, earnedRankTitles } from "@/lib/gamification/ranks";
import { achievementIcon } from "./icons";
import { PlayerAvatar } from "./PlayerAvatar";
import { motion } from "framer-motion";
import { Check, Lock, Pin, Sparkles, Star, X } from "lucide-react";
import { useEffect, useState } from "react";

type Tab = "avatars" | "frames" | "themes" | "badges" | "titles";

const TABS: { id: Tab; label: string }[] = [
  { id: "avatars", label: "Avatars" },
  { id: "frames", label: "Frames" },
  { id: "themes", label: "Themes" },
  { id: "badges", label: "Badges" },
  { id: "titles", label: "Titles" },
];

const RARITY_STYLE: Record<AchievementRarity, string> = {
  common: "text-slate-500 border-slate-300/50",
  rare: "text-sky-500 border-sky-400/50",
  epic: "text-fuchsia-500 border-fuchsia-400/50",
  legendary: "text-amber-500 border-amber-400/60",
};

export function ProfileCustomizerModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { snapshot, equipCosmetic, togglePinnedBadge, equipTitle, prestige } =
    useProgression();
  const [tab, setTab] = useState<Tab>("avatars");
  const [prestigeBusy, setPrestigeBusy] = useState(false);
  const [prestigeMsg, setPrestigeMsg] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!user || !snapshot) return null;

  const seed = user.id + (user.name || "Student");
  const { loadout, ownedCosmetics, achievements, progress, prestige: prestigeLevel } =
    snapshot;
  const ownedSet = new Set(ownedCosmetics);
  const canPrestige = progress.level >= 50;

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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

              <span className="line-clamp-1 text-xs font-semibold text-text">
                {c.name}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {c.rarity}
                {c.animated ? " · animated" : ""}
              </span>

              {equipped ? (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="h-3 w-3" />
                </span>
              ) : null}
              {!unlocked ? (
                <span className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-md bg-black/55 py-0.5 text-[9px] font-semibold text-white">
                  <Lock className="h-2.5 w-2.5" />
                  {cosmeticUnlockLabel(c)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  function renderBadges() {
    const unlockedSet = new Set(achievements);
    const pinned = loadout.pinnedBadges;
    return (
      <div>
        <p className="mb-3 text-xs text-muted">
          Pin up to 3 badges to your profile ({pinned.length}/3 pinned).
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {ACHIEVEMENT_IDS.map((id) => {
            const def = ACHIEVEMENTS[id];
            const Icon = achievementIcon(def.icon);
            const unlocked = unlockedSet.has(id);
            const isPinned = pinned.includes(id);
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
                      : "from-white/60 to-white/20 dark:from-white/10 dark:to-white/5",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-text">
                    {def.title}
                  </p>
                  <p className="text-[10px] capitalize text-muted">
                    {def.category} · {def.rarity}
                  </p>
                </div>
                {unlocked ? (
                  <button
                    type="button"
                    onClick={() => void togglePinnedBadge(id)}
                    disabled={!isPinned && pinned.length >= 3}
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

  function renderTitles() {
    const earned = earnedRankTitles(progress.level);
    return (
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => void equipTitle(null)}
          className={cn(
            "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition",
            loadout.titleId == null
              ? "border-primary/60 bg-primary/10 dark:border-cyan-400/50"
              : "border-white/45 bg-white/30 hover:bg-white/45 dark:border-white/10 dark:bg-white/[0.05]",
          )}
        >
          <span className="font-medium text-text">Use current rank (auto)</span>
          {loadout.titleId == null ? (
            <Check className="h-4 w-4 text-primary" />
          ) : null}
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
                  ? "border-primary/60 bg-primary/10 dark:border-cyan-400/50"
                  : "border-white/45 bg-white/30 hover:bg-white/45 dark:border-white/10 dark:bg-white/[0.05]",
                !unlocked && "cursor-not-allowed opacity-60",
              )}
            >
              <span
                className={cn(
                  "rounded-full bg-gradient-to-r px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white",
                  r.gradient,
                )}
              >
                {r.title}
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

  const handlePrestige = async () => {
    setPrestigeBusy(true);
    setPrestigeMsg(null);
    const res = await prestige();
    setPrestigeBusy(false);
    setPrestigeMsg(res.ok ? "Prestiged! Cosmetics kept, XP reset." : res.error ?? "Failed.");
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Customize profile"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm dark:bg-black/65"
        aria-label="Close"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="glass-card relative z-10 flex max-h-[min(90vh,760px)] w-full max-w-2xl flex-col overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b border-[var(--cc-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <PlayerAvatar
              avatarId={loadout.avatarId}
              frameId={loadout.frameId}
              seed={seed}
              size={44}
            />
            <div>
              <h2 className="flex items-center gap-1.5 text-base font-semibold text-text">
                <Sparkles className="h-4 w-4 text-primary" />
                Customize profile
              </h2>
              <p className="text-xs text-muted">
                Level {progress.level} · {ownedCosmetics.length} cosmetics owned
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-white/40 hover:text-text dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-[var(--cc-border)] px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                tab === t.id
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:bg-white/40 hover:text-text dark:hover:bg-white/10",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "avatars" && renderCosmeticGrid("avatar")}
          {tab === "frames" && renderCosmeticGrid("frame")}
          {tab === "themes" && renderCosmeticGrid("theme")}
          {tab === "badges" && renderBadges()}
          {tab === "titles" && renderTitles()}
        </div>

        {canPrestige ? (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--cc-border)] bg-amber-500/10 px-5 py-3">
            <div className="flex items-center gap-2 text-xs">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-text">
                Max level reached — Prestige to reset & earn +10% XP.
              </span>
            </div>
            <div className="flex items-center gap-2">
              {prestigeMsg ? (
                <span className="text-[11px] text-muted">{prestigeMsg}</span>
              ) : null}
              <button
                type="button"
                onClick={() => void handlePrestige()}
                disabled={prestigeBusy}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {prestigeBusy ? "…" : "Prestige"}
              </button>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
