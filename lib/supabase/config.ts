import {
  isResolvableSupabaseConfig,
  isValidSupabaseUrl,
  resolveSupabasePublicKey,
  resolveSupabaseUrl,
} from "./resolve-env";
import { getSupabaseRuntimeConfig } from "./runtime-config";

/**
 * Public (browser-safe) Supabase API key.
 * Use **anon** JWT (`eyJ…`) or **publishable** key (`sb_publishable_…`) from
 * Project Settings → API. Never use `sb_secret_…` or service_role here.
 */
export function getSupabasePublicKey(): string | undefined {
  const runtime = getSupabaseRuntimeConfig();
  if (runtime?.key) return runtime.key;
  return resolveSupabasePublicKey();
}

export function getSupabaseUrl(): string | undefined {
  const runtime = getSupabaseRuntimeConfig();
  if (runtime?.url) return runtime.url;
  return resolveSupabaseUrl();
}

/** Reject keys that must only run on the server (Vercel exposes `NEXT_PUBLIC_*` to the browser). */
export function assertBrowserSafeSupabaseKey(key: string): void {
  const k = key.trim();
  if (k.startsWith("sb_secret_")) {
    throw new Error(
      [
        "You put a Supabase **secret** key in a `NEXT_PUBLIC_` variable.",
        "Browsers cannot use secret keys — use the **anon** or **publishable** key instead.",
        "Supabase → Project Settings → API:",
        "- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = **anon public** (JWT), or",
        "- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = **publishable** (`sb_publishable_…`)",
        "Remove any `sb_secret_…` value from Vercel env and redeploy.",
      ].join("\n"),
    );
  }
}

/** True when Supabase URL + a browser-safe public key are set. */
export function isSupabaseEnabled(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabasePublicKey();
  if (!url || !key) return false;
  if (key.startsWith("sb_secret_")) return false;
  return isValidSupabaseUrl(url);
}

/** Shown when sign-up is blocked because cloud auth is required. */
export function supabaseRequiredMessage(): string {
  return [
    "Supabase is not configured or the URL / key is invalid.",
    "In Vercel (or `.env.local`) set:",
    "NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public JWT> **or**",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_…>",
    "Never use `sb_secret_…` in `NEXT_PUBLIC_*` — that causes “Forbidden use of secret API key in browser”.",
    "Redeploy after changing env vars.",
  ].join(" ");
}

/** Server-side check (includes non-NEXT_PUBLIC env names). */
export { isResolvableSupabaseConfig };
