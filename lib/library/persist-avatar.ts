import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { AVATAR_STORAGE_KEY } from "./avatar-catalog";
import { isBlockyAvatarUrl, parseBlockyAvatar } from "./blocky-avatar";

/** Save avatar data (blocky config string) to Supabase profile + localStorage. */
export async function persistAvatarUrl(url: string): Promise<void> {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", userData.user.id);
      if (error) throw error;
    }
  }
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, url);
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

  if (!url) {
    try {
      url = localStorage.getItem(AVATAR_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  return isUsableAvatarUrl(url) ? url : null;
}
