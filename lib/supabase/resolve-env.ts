/** Trim env string; empty → undefined */
function trimEnv(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

/** Project URL from any name Vercel / Supabase integration may set. */
export function resolveSupabaseUrl(): string | undefined {
  return trimEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
      process.env.SUPABASE_URL ??
      process.env.SUPABASE_PROJECT_URL,
  );
}

/** Browser-safe anon JWT or publishable key (never `sb_secret_`). */
export function resolveSupabasePublicKey(): string | undefined {
  const candidates = [
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
  ];
  for (const raw of candidates) {
    const k = trimEnv(raw);
    if (!k || k.startsWith("sb_secret_")) continue;
    return k;
  }
  return undefined;
}

export function isValidSupabaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isResolvableSupabaseConfig(): boolean {
  const url = resolveSupabaseUrl();
  const key = resolveSupabasePublicKey();
  return Boolean(url && key && isValidSupabaseUrl(url));
}
