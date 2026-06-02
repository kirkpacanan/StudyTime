import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertBrowserSafeSupabaseKey,
  getSupabasePublicKey,
  getSupabaseUrl,
  isSupabaseEnabled,
} from "./config";

let browserClient: SupabaseClient | null = null;

/** Browser-only singleton. Throws if env missing or called on the server. */
export function getSupabaseBrowser(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("getSupabaseBrowser() must run in the browser.");
  }
  if (!isSupabaseEnabled()) {
    throw new Error(
      [
        "Supabase env not configured correctly.",
        "Set in Vercel or `./.env.local`:",
        "NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public> **or** NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable>",
      ].join("\n"),
    );
  }
  if (browserClient) return browserClient;
  const url = getSupabaseUrl()!;
  const key = getSupabasePublicKey()!;

  assertBrowserSafeSupabaseKey(key);

  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL must use http/https");
    }
  } catch {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL. It must start with `http://` or `https://` (Supabase Project URL).",
    );
  }

  browserClient = createBrowserClient(url, key);
  return browserClient;
}
