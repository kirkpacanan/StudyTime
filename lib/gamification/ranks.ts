/**
 * Rank + level progression math (pure, no browser APIs).
 *
 * Level curve: the XP needed to advance *from* a given level to the next grows
 * linearly so early levels are quick and later ones feel earned.
 *
 *   xpForLevel(level) = 300 + (level - 1) * 225
 *
 * (Tuned so reaching Level 14 needs ~3,000 XP into Level 13 — matches the
 * product spec example "2,340 / 3,000 XP" at Level 13.)
 */

export const MAX_LEVEL = 50;

export type RankSlug =
  | "brainrot_victim"
  | "tryhard_apprentice"
  | "locked_in"
  | "main_character"
  | "no_cap_scholar"
  | "academic_weapon"
  | "rizz_professor"
  | "study_goat";

export type RankDef = {
  slug: RankSlug;
  title: string;
  levelMin: number;
  levelMax: number;
  /** Tailwind gradient classes used for rank chips / accents. */
  gradient: string;
  /** Accent hex used by share/badge rendering. */
  accent: string;
};

export const RANKS: RankDef[] = [
  {
    slug: "brainrot_victim",
    title: "Brainrot Victim",
    levelMin: 1,
    levelMax: 5,
    gradient: "from-stone-400 to-stone-600",
    accent: "#94a3b8",
  },
  {
    slug: "tryhard_apprentice",
    title: "Tryhard Apprentice",
    levelMin: 6,
    levelMax: 10,
    gradient: "from-emerald-400 to-emerald-600",
    accent: "#34d399",
  },
  {
    slug: "locked_in",
    title: "Locked In",
    levelMin: 11,
    levelMax: 15,
    gradient: "from-blue-400 to-blue-600",
    accent: "#4f86f7",
  },
  {
    slug: "main_character",
    title: "Main Character",
    levelMin: 16,
    levelMax: 20,
    gradient: "from-purple-400 to-purple-700",
    accent: "#c084fc",
  },
  {
    slug: "no_cap_scholar",
    title: "No Cap Scholar",
    levelMin: 21,
    levelMax: 25,
    gradient: "from-orange-400 to-orange-600",
    accent: "#fbbf24",
  },
  {
    slug: "academic_weapon",
    title: "Academic Weapon",
    levelMin: 26,
    levelMax: 30,
    gradient: "from-red-400 to-red-700",
    accent: "#fb7185",
  },
  {
    slug: "rizz_professor",
    title: "Rizz Professor",
    levelMin: 31,
    levelMax: 40,
    gradient: "from-amber-400 to-yellow-600",
    accent: "#f59e0b",
  },
  {
    slug: "study_goat",
    title: "Study GOAT",
    levelMin: 41,
    levelMax: 50,
    gradient: "from-slate-300 via-slate-400 to-slate-500",
    accent: "#cbd5e1",
  },
];

/** XP required to advance from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return 300 + (lvl - 1) * 225;
}

/** Cumulative XP needed to *reach* a level (level 1 = 0). */
export function totalXpToReachLevel(level: number): number {
  const target = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  let total = 0;
  for (let l = 1; l < target; l++) total += xpForLevel(l);
  return total;
}

export function levelFromTotalXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < MAX_LEVEL && xp >= totalXpToReachLevel(level + 1)) {
    level++;
  }
  return level;
}

export type LevelProgress = {
  level: number;
  /** XP accumulated inside the current level. */
  xpIntoLevel: number;
  /** XP needed to complete the current level. */
  xpForThisLevel: number;
  /** XP remaining to next level (0 when maxed). */
  toNext: number;
  /** 0–100 progress through the current level. */
  percent: number;
  isMaxLevel: boolean;
};

export function levelProgress(totalXp: number): LevelProgress {
  const level = levelFromTotalXp(totalXp);
  const floor = totalXpToReachLevel(level);
  if (level >= MAX_LEVEL) {
    return {
      level: MAX_LEVEL,
      xpIntoLevel: Math.max(0, Math.floor(totalXp) - floor),
      xpForThisLevel: xpForLevel(MAX_LEVEL),
      toNext: 0,
      percent: 100,
      isMaxLevel: true,
    };
  }
  const xpForThisLevel = xpForLevel(level);
  const xpIntoLevel = Math.max(0, Math.floor(totalXp) - floor);
  const percent = Math.min(
    100,
    Math.max(0, Math.round((xpIntoLevel / xpForThisLevel) * 100)),
  );
  return {
    level,
    xpIntoLevel,
    xpForThisLevel,
    toNext: Math.max(0, xpForThisLevel - xpIntoLevel),
    percent,
    isMaxLevel: false,
  };
}

export function rankForLevel(level: number): RankDef {
  const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return RANKS.find((r) => lvl >= r.levelMin && lvl <= r.levelMax) ?? RANKS[0];
}

export function rankForTotalXp(totalXp: number): RankDef {
  return rankForLevel(levelFromTotalXp(totalXp));
}

/** Next rank tier after the supplied level (null if already top tier). */
export function nextRankForLevel(level: number): RankDef | null {
  const current = rankForLevel(level);
  const idx = RANKS.findIndex((r) => r.slug === current.slug);
  return idx >= 0 && idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
}

/** XP required (from 0) to reach the start of the next rank. */
export function xpRequiredForNextRank(totalXp: number): number | null {
  const level = levelFromTotalXp(totalXp);
  const next = nextRankForLevel(level);
  if (!next) return null;
  return totalXpToReachLevel(next.levelMin);
}

/** All rank titles a player has earned at or below their current level. */
export function earnedRankTitles(level: number): RankDef[] {
  return RANKS.filter((r) => r.levelMin <= level);
}
