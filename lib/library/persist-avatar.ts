import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { AVATAR_STORAGE_KEY } from "./avatar-catalog";
import { isBlockyAvatarUrl, parseBlockyAvatar } from "./blocky-avatar";

function avatarStorageKey(userId?: string | null): string {
  return userId ? `${AVATAR_STORAGE_KEY}_${userId}` : AVATAR_STORAGE_KEY;
}

function readLocalAvatar(userId?: string | null): string | null {
  try {
    const scoped = localStorage.getItem(avatarStorageKey(userId));
    if (scoped) return scoped;
    // Legacy key (pre user-scoped storage)
    return localStorage.getItem(AVATAR_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLocalAvatar(url: string, userId?: string | null): void {
  try {
    localStorage.setItem(avatarStorageKey(userId), url);
    // Drop legacy key so another account on the same browser is not affected.
    if (userId) localStorage.removeItem(AVATAR_STORAGE_KEY);
  } catch {
    /* ignore quota errors */
  }
}

function isUsableAvatarUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.includes("readyplayer.me")) return false;
  if (isBlockyAvatarUrl(url)) return parseBlockyAvatar(url) !== null;
  return false;
}

/** Save avatar data (blocky config string) to Supabase profile + localStorage. */
export async function persistAvatarUrl(url: string): Promise<void> {
  let userId: string | null = null;

  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    const { data: userData } = await supabase.auth.getUser();
    userId = userData.user?.id ?? null;
    if (userData.user) {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", userData.user.id);
      if (error) throw error;
    }
  }

  writeLocalAvatar(url, userId);
}

/** Load saved blocky avatar string from Supabase profile or localStorage. */
export async function loadAvatarUrl(userId: string): Promise<string | null> {
  let url: string | null = null;

  if (isSupabaseEnabled()) {
    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .single();
      if (data?.avatar_url) url = data.avatar_url as string;
    } catch {
      /* ignore */
    }
  }

  if (!isUsableAvatarUrl(url)) {
    const local = readLocalAvatar(userId);
    if (isUsableAvatarUrl(local)) url = local;
  }

  return isUsableAvatarUrl(url) ? url : null;
}
