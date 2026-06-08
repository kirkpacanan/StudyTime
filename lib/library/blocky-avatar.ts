/** Roblox-style blocky avatar appearance (R6 proportions). */
export type HairStyle = "none" | "classic" | "spiky" | "long" | "afro" | "mohawk";
export type FaceStyle = "classic" | "smile" | "happy" | "cool" | "sleepy" | "surprised";

export type BlockyAvatarConfig = {
  skin: string;
  shirt: string;
  pants: string;
  hairStyle: HairStyle;
  hairColor: string;
  faceStyle: FaceStyle;
};

export const BLOCKY_AVATAR_PREFIX = "blocky:";

export const DEFAULT_BLOCKY_AVATAR: BlockyAvatarConfig = {
  skin: "#E0AC69",
  shirt: "#2484C6",
  pants: "#1B2A41",
  hairStyle: "classic",
  hairColor: "#4A3728",
  faceStyle: "happy",
};

export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: "none", label: "Bald" },
  { id: "classic", label: "Classic" },
  { id: "spiky", label: "Spiky" },
  { id: "long", label: "Long" },
  { id: "afro", label: "Afro" },
  { id: "mohawk", label: "Mohawk" },
];

export const FACE_STYLES: { id: FaceStyle; label: string; emoji: string }[] = [
  { id: "happy", label: "Happy", emoji: "😊" },
  { id: "smile", label: "Smile", emoji: "🙂" },
  { id: "classic", label: "Classic", emoji: "😶" },
  { id: "cool", label: "Cool", emoji: "😎" },
  { id: "sleepy", label: "Sleepy", emoji: "😴" },
  { id: "surprised", label: "Wow", emoji: "😮" },
];

export const BLOCKY_PRESETS: { name: string; config: BlockyAvatarConfig }[] = [
  { name: "Classic Blue", config: { skin: "#E0AC69", shirt: "#2484C6", pants: "#1B2A41", hairStyle: "classic", hairColor: "#4A3728", faceStyle: "happy" } },
  { name: "Red Rider", config: { skin: "#FFCC99", shirt: "#C4281C", pants: "#2B2B2B", hairStyle: "spiky", hairColor: "#1A1A1A", faceStyle: "cool" } },
  { name: "Green Scout", config: { skin: "#D4A574", shirt: "#28A745", pants: "#343A40", hairStyle: "mohawk", hairColor: "#2D5016", faceStyle: "smile" } },
  { name: "Purple Pro", config: { skin: "#F5CBA7", shirt: "#7B2D8E", pants: "#1A1A2E", hairStyle: "long", hairColor: "#2C1810", faceStyle: "happy" } },
  { name: "Gold Star", config: { skin: "#E8B88A", shirt: "#F0B429", pants: "#4A3728", hairStyle: "afro", hairColor: "#1A1A1A", faceStyle: "surprised" } },
  { name: "Pink Pop", config: { skin: "#FFDBAC", shirt: "#FF69B4", pants: "#6C3483", hairStyle: "classic", hairColor: "#FF69B4", faceStyle: "happy" } },
  { name: "Orange Blaze", config: { skin: "#C68642", shirt: "#FF6B35", pants: "#2D2D2D", hairStyle: "spiky", hairColor: "#FF6B35", faceStyle: "cool" } },
  { name: "Teal Tide", config: { skin: "#E0AC69", shirt: "#17A2B8", pants: "#0D3B47", hairStyle: "none", hairColor: "#4A3728", faceStyle: "smile" } },
];

export const SKIN_SWATCHES = [
  "#FFDBAC", "#F1C27D", "#E0AC69", "#C68642", "#8D5524", "#5C3D2E",
];
export const SHIRT_SWATCHES = [
  "#2484C6", "#C4281C", "#28A745", "#7B2D8E", "#F0B429", "#FF69B4",
  "#17A2B8", "#FF6B35", "#6C757D", "#212529", "#FFFFFF", "#FD7E14",
];
export const PANTS_SWATCHES = [
  "#1B2A41", "#2B2B2B", "#343A40", "#1A1A2E", "#4A3728", "#6C3483",
  "#0D3B47", "#2D2D2D", "#5C4033", "#1E3A5F", "#3D3D3D", "#000000",
];
export const HAIR_SWATCHES = [
  "#1A1A1A", "#4A3728", "#2C1810", "#8B6914", "#FFD700", "#FF69B4",
  "#C4281C", "#2484C6", "#FFFFFF", "#7B2D8E", "#2D5016", "#FF6B35",
];

function withDefaults(partial: Partial<BlockyAvatarConfig>): BlockyAvatarConfig | null {
  if (!partial.skin || !partial.shirt || !partial.pants) return null;
  return {
    skin: partial.skin,
    shirt: partial.shirt,
    pants: partial.pants,
    hairStyle: partial.hairStyle ?? DEFAULT_BLOCKY_AVATAR.hairStyle,
    hairColor: partial.hairColor ?? DEFAULT_BLOCKY_AVATAR.hairColor,
    faceStyle: partial.faceStyle ?? DEFAULT_BLOCKY_AVATAR.faceStyle,
  };
}

export function serializeBlockyAvatar(config: BlockyAvatarConfig): string {
  const json = JSON.stringify(config);
  const encoded =
    typeof btoa !== "undefined"
      ? btoa(json)
      : Buffer.from(json, "utf-8").toString("base64");
  return `${BLOCKY_AVATAR_PREFIX}${encoded}`;
}

export function parseBlockyAvatar(value: string | null | undefined): BlockyAvatarConfig | null {
  if (!value?.startsWith(BLOCKY_AVATAR_PREFIX)) return null;
  try {
    const encoded = value.slice(BLOCKY_AVATAR_PREFIX.length);
    const json =
      typeof atob !== "undefined"
        ? atob(encoded)
        : Buffer.from(encoded, "base64").toString("utf-8");
    return withDefaults(JSON.parse(json) as Partial<BlockyAvatarConfig>);
  } catch {
    return null;
  }
}

const HAIR_STYLE_IDS = HAIR_STYLES.map((h) => h.id);
const FACE_STYLE_IDS = FACE_STYLES.map((f) => f.id);

/** Deterministic blocky colors from a user id (for peers / skip). */
export function blockyAvatarFromSeed(seed: string): BlockyAvatarConfig {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const pick = <T,>(arr: T[], shift = 0) => arr[Math.abs(hash >> shift) % arr.length];
  return {
    skin: pick(SKIN_SWATCHES, 4),
    shirt: pick(SHIRT_SWATCHES, 6),
    pants: pick(PANTS_SWATCHES, 8),
    hairStyle: pick(HAIR_STYLE_IDS, 10),
    hairColor: pick(HAIR_SWATCHES, 12),
    faceStyle: pick(FACE_STYLE_IDS, 14),
  };
}

export function isBlockyAvatarUrl(value: string | null | undefined): boolean {
  return !!value?.startsWith(BLOCKY_AVATAR_PREFIX);
}
