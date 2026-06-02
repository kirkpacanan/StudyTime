import { NextResponse } from "next/server";
import {
  isResolvableSupabaseConfig,
  resolveSupabasePublicKey,
  resolveSupabaseUrl,
} from "@/lib/supabase/resolve-env";

/** Runtime public Supabase config (anon/publishable only — safe to expose). */
export async function GET() {
  const url = resolveSupabaseUrl();
  const key = resolveSupabasePublicKey();

  if (!isResolvableSupabaseConfig() || !url || !key) {
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json({
    enabled: true,
    url,
    key,
  });
}
