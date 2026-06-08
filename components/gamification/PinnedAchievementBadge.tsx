import { cn } from "@/lib/cn";
import {
  ACHIEVEMENTS,
  type AchievementId,
  type AchievementRarity,
} from "@/lib/gamification/achievements";
import { achievementIcon } from "./icons";

export const ACHIEVEMENT_RARITY_STYLE: Record<AchievementRarity, string> = {
  common:
    "text-slate-500 border-slate-300/50 from-slate-100/60 to-slate-200/20 dark:from-slate-800/40 dark:to-slate-700/10",
  rare: "text-sky-500 border-sky-400/50 from-sky-100/60 to-sky-200/20 dark:from-sky-900/40 dark:to-sky-800/10",
  epic: "text-fuchsia-500 border-fuchsia-400/50 from-fuchsia-100/60 to-fuchsia-200/20 dark:from-fuchsia-900/40 dark:to-fuchsia-800/10",
  legendary:
    "text-amber-500 border-amber-400/60 from-amber-100/60 to-amber-200/20 dark:from-amber-900/40 dark:to-amber-800/10",
};

const SIZE = {
  sm: { box: "h-6 w-6", icon: "h-3 w-3", chip: "text-xs px-2 py-1" },
  md: { box: "h-7 w-7", icon: "h-3.5 w-3.5", chip: "text-xs px-2.5 py-1.5" },
  lg: { box: "h-8 w-8", icon: "h-4 w-4", chip: "text-xs px-2.5 py-1.5" },
} as const;

function rarityClasses(
  def: (typeof ACHIEVEMENTS)[AchievementId],
  animated = true,
) {
  return cn(
    "bg-gradient-to-br",
    ACHIEVEMENT_RARITY_STYLE[def.rarity],
    animated && def.animated
      ? "badge-shimmer from-amber-200 via-yellow-100 to-amber-300"
      : "",
  );
}

type PinnedAchievementBadgeProps = {
  id: AchievementId;
  size?: keyof typeof SIZE;
  showTitle?: boolean;
  className?: string;
  title?: string;
};

export function PinnedAchievementBadge({
  id,
  size = "md",
  showTitle = false,
  className,
  title,
}: PinnedAchievementBadgeProps) {
  const def = ACHIEVEMENTS[id];
  const Icon = achievementIcon(def.icon);
  const s = SIZE[size];

  if (showTitle) {
    return (
      <span
        title={title ?? def.description}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border font-semibold",
          s.chip,
          rarityClasses(def),
          className,
        )}
      >
        <Icon className={s.icon} /> {def.title}
      </span>
    );
  }

  return (
    <div
      title={title ?? def.title}
      className={cn(
        "flex items-center justify-center rounded-lg border",
        s.box,
        rarityClasses(def),
        className,
      )}
    >
      <Icon className={s.icon} />
    </div>
  );
}
