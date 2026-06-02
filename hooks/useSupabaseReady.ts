"use client";

import { isSupabaseEnabled } from "@/lib/supabase/config";
import {
  notifySupabaseConfigReady,
  setSupabaseRuntimeConfig,
  SUPABASE_CONFIG_READY_EVENT,
} from "@/lib/supabase/runtime-config";
import { useCallback, useEffect, useState } from "react";

async function fetchAndApplyRuntimeConfig(): Promise<boolean> {
  const res = await fetch("/api/supabase-config", { cache: "no-store" });
  const data = (await res.json()) as {
    enabled?: boolean;
    url?: string;
    key?: string;
  };
  if (!data.enabled || !data.url || !data.key) return false;
  setSupabaseRuntimeConfig(data.url, data.key);
  notifySupabaseConfigReady();
  return true;
}

/** True once Supabase URL + public key are available (build-time or runtime API). */
export function useSupabaseReady(): {
  ready: boolean;
  enabled: boolean;
  recheck: () => void;
} {
  const [enabled, setEnabled] = useState(() => isSupabaseEnabled());
  const [ready, setReady] = useState(() => isSupabaseEnabled());

  const recheck = useCallback(() => {
    const on = isSupabaseEnabled();
    setEnabled(on);
    setReady(true);
  }, []);

  useEffect(() => {
    if (isSupabaseEnabled()) {
      setEnabled(true);
      setReady(true);
      return;
    }

    let cancelled = false;

    const onReady = () => {
      if (!cancelled) recheck();
    };
    window.addEventListener(SUPABASE_CONFIG_READY_EVENT, onReady);

    (async () => {
      try {
        const ok = await fetchAndApplyRuntimeConfig();
        if (!cancelled && ok) setEnabled(true);
      } catch {
        /* show setup message on signup */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener(SUPABASE_CONFIG_READY_EVENT, onReady);
    };
  }, [recheck]);

  return { ready, enabled, recheck };
}
