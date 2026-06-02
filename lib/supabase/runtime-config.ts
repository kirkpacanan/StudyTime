/**
 * Client-side override when build-time `NEXT_PUBLIC_*` was empty but the server
 * has Supabase env at runtime (e.g. Vercel env added after build, or integration
 * vars named `SUPABASE_URL` only).
 */
let runtime: { url: string; key: string } | null = null;

export function setSupabaseRuntimeConfig(url: string, key: string): void {
  runtime = { url, key };
}

export function getSupabaseRuntimeConfig(): { url: string; key: string } | null {
  return runtime;
}

export function clearSupabaseRuntimeConfig(): void {
  runtime = null;
}

export const SUPABASE_CONFIG_READY_EVENT = "studytime-supabase-config-ready";

export function notifySupabaseConfigReady(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SUPABASE_CONFIG_READY_EVENT));
  }
}
