/**
 * VALID avatar library — free MIT-licensed GLB models via jsDelivr CDN.
 * Replaces Ready Player Me (service shut down; domains no longer resolve).
 *
 * @see https://github.com/c-frame/valid-avatars-glb
 */

export const VALID_AVATARS_BASE =
  "https://cdn.jsdelivr.net/gh/c-frame/valid-avatars-glb@c539a28/";

export const VALID_AVATARS_JSON = `${VALID_AVATARS_BASE}avatars.json`;

export const AVATAR_STORAGE_KEY = "studytime_avatar_url";

export type AvatarCatalogEntry = {
  text: string;
  image: string;
  model: string;
  ethnicity: string;
  gender: "M" | "F" | string;
  num: string;
  outfit: string;
};

export function avatarPreviewUrl(entry: AvatarCatalogEntry): string {
  return `${VALID_AVATARS_BASE}${entry.image}`;
}

export function avatarModelUrl(entry: AvatarCatalogEntry): string {
  return `${VALID_AVATARS_BASE}${entry.model}`;
}

/** Fetch the full catalog (210 avatars). Cached by the browser after first load. */
export async function fetchAvatarCatalog(): Promise<AvatarCatalogEntry[]> {
  const res = await fetch(VALID_AVATARS_JSON);
  if (!res.ok) throw new Error(`Could not load avatar catalog (${res.status})`);
  const data = (await res.json()) as AvatarCatalogEntry[];
  return data.filter((e) => e.model?.endsWith(".glb") && e.image);
}

export type AvatarFilter = {
  gender: "all" | "M" | "F";
  outfit: "all" | "Casual" | "Busi" | "Medi" | "Milit" | "Util";
  query: string;
};

export function filterAvatars(
  entries: AvatarCatalogEntry[],
  filter: AvatarFilter,
): AvatarCatalogEntry[] {
  const q = filter.query.trim().toLowerCase();
  return entries.filter((e) => {
    if (filter.gender !== "all" && e.gender !== filter.gender) return false;
    if (filter.outfit !== "all" && e.outfit !== filter.outfit) return false;
    if (q && !e.text.toLowerCase().includes(q)) return false;
    return true;
  });
}
