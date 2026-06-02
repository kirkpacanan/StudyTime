"use client";

import { isSupabaseEnabled } from "@/lib/supabase/config";
import {
  notifySupabaseConfigReady,
  setSupabaseRuntimeConfig,
} from "@/lib/supabase/runtime-config";
import { useEffect } from "react";

/** Loads Supabase env from the server when build-time `NEXT_PUBLIC_*` is missing. */
export function SupabaseEnvBootstrap() {
  useEffect(() => {
    if (isSupabaseEnabled()) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/supabase-config", { cache: "no-store" });
        const data = (await res.json()) as {
          enabled?: boolean;
          url?: string;
          key?: string;
        };
        if (cancelled || !data.enabled || !data.url || !data.key) return;
        setSupabaseRuntimeConfig(data.url, data.key);
        notifySupabaseConfigReady();
      } catch {
        /* ignore — signup page shows setup instructions */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
