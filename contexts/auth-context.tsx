"use client";

import type { PublicUser } from "@/lib/auth";
import {
  getCurrentUser,
  mapSupabaseUser,
  signOut as authSignOut,
} from "@/lib/auth";
import { seedDemoData } from "@/lib/seed-demo";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type AuthContextValue = {
  user: PublicUser | null;
  ready: boolean;
  refreshUser: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);
  const sbSubRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initLocal() {
      await seedDemoData();
      if (!cancelled) {
        setUser(getCurrentUser());
        setReady(true);
      }
    }

    if (isSupabaseEnabled()) {
      const supabase = getSupabaseBrowser();
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!cancelled) {
          setUser(session?.user ? mapSupabaseUser(session.user) : null);
          setReady(true);
        }
      });
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!cancelled) {
          setUser(
            nextSession?.user ? mapSupabaseUser(nextSession.user) : null,
          );
        }
      });
      sbSubRef.current = subscription;
      return () => {
        cancelled = true;
        sbSubRef.current?.unsubscribe();
        sbSubRef.current = null;
      };
    }

    void initLocal();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshUser = useCallback(() => {
    if (isSupabaseEnabled()) {
      void (async () => {
        try {
          const supabase = getSupabaseBrowser();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          setUser(session?.user ? mapSupabaseUser(session.user) : null);
        } catch {
          setUser(null);
        }
      })();
      return;
    }
    setUser(getCurrentUser());
  }, []);

  const signOut = useCallback(() => {
    void (async () => {
      await authSignOut();
      setUser(null);
    })();
  }, []);

  const value = useMemo(
    () => ({ user, ready, refreshUser, signOut }),
    [user, ready, refreshUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
