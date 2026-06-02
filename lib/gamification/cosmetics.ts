/**
 * Cosmetics catalog (code source-of-truth, mirrored into the `cosmetics` table
 * by the migration seed). Per-user ownership lives in `user_cosmetics`.
 *
 * Adding a new cosmetic = append here + add a matching seed row. The reward
 * service grants everything whose unlock requirement is met, so future drops
 * flow automatically.
 */

export type CosmeticType = "avatar" | "frame" | "theme";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export type CosmeticDef = {
  id: string;
  type: CosmeticType;
  name: string;
  rarity: Rarity;
  /** Level at which this unlocks (1 = starter, always owned). */
  unlockLevel: number;
  /** Optional extra gate: requires at least this prestige level. */
  unlockPrestige?: number;
  animated?: boolean;
  metadata: Record<string, unknown>;
};

/** Dicebear avatar URL for a style + seed. */
export function dicebearUrl(style: string, seed: string): string {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(
    seed,
  )}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export const COSMETICS: CosmeticDef[] = [
  // ---- Avatars ----
  {
    id: "avatar_starter",
    type: "avatar",
    name: "Fresh Start",
    rarity: "common",
    unlockLevel: 1,
    metadata: { style: "avataaars" },
  },
  {
    id: "avatar_bot",
    type: "avatar",
    name: "Focus Bot",
    rarity: "common",
    unlockLevel: 6,
    metadata: { style: "bottts" },
  },
  {
    id: "avatar_locked_neon",
    type: "avatar",
    name: "Neon Scholar",
    rarity: "rare",
    unlockLevel: 11,
    metadata: { style: "adventurer" },
  },
  {
    id: "avatar_locked_pixel",
    type: "avatar",
    name: "Pixel Grinder",
    rarity: "rare",
    unlockLevel: 11,
    metadata: { style: "pixel-art" },
  },
  {
    id: "avatar_locked_fun",
    type: "avatar",
    name: "Lo-fi Hero",
    rarity: "rare",
    unlockLevel: 11,
    metadata: { style: "fun-emoji" },
  },
  {
    id: "avatar_main_lorelei",
    type: "avatar",
    name: "Main Character",
    rarity: "epic",
    unlockLevel: 16,
    metadata: { style: "lorelei" },
  },
  {
    id: "avatar_weapon_thumbs",
    type: "avatar",
    name: "Academic Weapon",
    rarity: "epic",
    unlockLevel: 26,
    metadata: { style: "thumbs" },
  },
  {
    id: "avatar_goat",
    type: "avatar",
    name: "The GOAT",
    rarity: "legendary",
    unlockLevel: 41,
    metadata: { style: "micah" },
  },

  // ---- Frames ----
  {
    id: "frame_none",
    type: "frame",
    name: "No Frame",
    rarity: "common",
    unlockLevel: 1,
    metadata: {
      ring: "ring-2 ring-white/40 dark:ring-white/15",
      ringCss: "0 0 0 2px rgba(255,255,255,0.4)",
    },
  },
  {
    id: "frame_locked_in",
    type: "frame",
    name: "Locked-In Glow",
    rarity: "rare",
    unlockLevel: 6,
    metadata: {
      ring: "ring-2 ring-sky-400/80 shadow-[0_0_22px_-2px_rgba(79,134,247,0.65)]",
      ringCss: "0 0 0 2px rgba(56,189,248,0.8), 0 0 22px -2px rgba(79,134,247,0.65)",
    },
  },
  {
    id: "frame_apprentice",
    type: "frame",
    name: "Emerald Ring",
    rarity: "common",
    unlockLevel: 11,
    metadata: {
      ring: "ring-2 ring-emerald-400/70 shadow-[0_0_18px_-2px_rgba(52,211,153,0.55)]",
      ringCss: "0 0 0 2px rgba(52,211,153,0.7), 0 0 18px -2px rgba(52,211,153,0.55)",
    },
  },
  {
    id: "frame_professor",
    type: "frame",
    name: "Prismatic Pulse",
    rarity: "epic",
    unlockLevel: 16,
    animated: true,
    metadata: {
      ring: "ring-2 ring-cyan-300/80",
      ringCss: "0 0 0 2px rgba(103,232,249,0.8)",
      animatedClass: "cosmetic-frame-prismatic",
      shards: true,
    },
  },
  {
    id: "frame_main_animated",
    type: "frame",
    name: "Animated Aura",
    rarity: "epic",
    unlockLevel: 31,
    animated: true,
    metadata: {
      ring: "ring-2 ring-fuchsia-400/80",
      ringCss: "0 0 0 2px rgba(232,121,249,0.8)",
      animatedClass: "cosmetic-frame-aura",
      particles: true,
    },
  },
  {
    id: "frame_goat_crown",
    type: "frame",
    name: "GOAT Crown",
    rarity: "legendary",
    unlockLevel: 41,
    animated: true,
    metadata: {
      ring: "ring-2 ring-amber-300/90 shadow-[0_0_28px_-2px_rgba(250,204,21,0.7)]",
      ringCss: "0 0 0 2px rgba(252,211,77,0.9), 0 0 28px -2px rgba(250,204,21,0.7)",
      animatedClass: "cosmetic-frame-goat",
      crown: true,
    },
  },
  {
    id: "frame_prestige",
    type: "frame",
    name: "Prestige Halo",
    rarity: "legendary",
    unlockLevel: 1,
    unlockPrestige: 1,
    animated: true,
    metadata: {
      ring: "ring-2 ring-rose-300/90 shadow-[0_0_30px_-2px_rgba(244,114,182,0.7)]",
      ringCss: "0 0 0 2px rgba(253,164,175,0.9), 0 0 30px -2px rgba(244,114,182,0.7)",
      animatedClass: "cosmetic-frame-halo",
      halo: true,
    },
  },

  // ---- Themes (profile accent colors) ----
  {
    id: "theme_default",
    type: "theme",
    name: "Sky Default",
    rarity: "common",
    unlockLevel: 1,
    metadata: { accent: "#4f86f7", gradient: "from-sky-400 to-blue-600" },
  },
  {
    id: "theme_forest",
    type: "theme",
    name: "Forest",
    rarity: "common",
    unlockLevel: 6,
    metadata: { accent: "#34d399", gradient: "from-emerald-400 to-teal-600" },
  },
  {
    id: "theme_focus_pack",
    type: "theme",
    name: "Focus Pack",
    rarity: "rare",
    unlockLevel: 11,
    metadata: { accent: "#6366f1", gradient: "from-indigo-400 to-blue-600" },
  },
  {
    id: "theme_main_banner",
    type: "theme",
    name: "Spotlight Banner",
    rarity: "epic",
    unlockLevel: 16,
    metadata: {
      accent: "#c084fc",
      gradient: "from-fuchsia-400 to-purple-600",
      banner: true,
    },
  },
  {
    id: "theme_sunset",
    type: "theme",
    name: "Sunset",
    rarity: "rare",
    unlockLevel: 21,
    metadata: { accent: "#fb7185", gradient: "from-amber-400 to-rose-500" },
  },
  {
    id: "theme_goat_gold",
    type: "theme",
    name: "GOAT Gold",
    rarity: "legendary",
    unlockLevel: 41,
    metadata: {
      accent: "#facc15",
      gradient: "from-yellow-300 via-amber-400 to-yellow-600",
    },
  },
];

export const COSMETICS_BY_ID: Record<string, CosmeticDef> = Object.fromEntries(
  COSMETICS.map((c) => [c.id, c]),
);

export const DEFAULT_AVATAR_ID = "avatar_starter";
export const DEFAULT_FRAME_ID = "frame_none";
export const DEFAULT_THEME_ID = "theme_default";

/** Cosmetics every account owns from the start. */
export const STARTER_COSMETIC_IDS = COSMETICS.filter(
  (c) => c.unlockLevel <= 1 && c.unlockPrestige == null,
).map((c) => c.id);

export function cosmeticsByType(type: CosmeticType): CosmeticDef[] {
  return COSMETICS.filter((c) => c.type === type);
}

export function isCosmeticUnlocked(
  c: CosmeticDef,
  level: number,
  prestige: number,
): boolean {
  if (c.unlockPrestige != null && prestige < c.unlockPrestige) return false;
  return level >= c.unlockLevel;
}

/** Human-readable unlock requirement for locked cosmetics. */
export function cosmeticUnlockLabel(c: CosmeticDef): string {
  if (c.unlockPrestige != null) {
    return c.unlockLevel > 1
      ? `Prestige ${c.unlockPrestige} · Level ${c.unlockLevel}`
      : `Prestige ${c.unlockPrestige}`;
  }
  return `Level ${c.unlockLevel}`;
}

/**
 * Reward-granting service: returns the set of cosmetic ids a player at the
 * given level/prestige is entitled to. The data layer diffs this against owned
 * rows so rewards are granted exactly once (no duplicates).
 */
export function entitledCosmeticIds(level: number, prestige: number): string[] {
  return COSMETICS.filter((c) => isCosmeticUnlocked(c, level, prestige)).map(
    (c) => c.id,
  );
}
