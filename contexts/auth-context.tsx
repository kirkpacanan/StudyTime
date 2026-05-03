"use client";

import type { PublicUser } from "@/lib/auth";
import { getCurrentUser, signOut as authSignOut } from "@/lib/auth";
import { seedDemoData } from "@/lib/seed-demo";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await seedDemoData();
      if (!cancelled) {
        setUser(getCurrentUser());
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshUser = useCallback(() => {
    setUser(getCurrentUser());
  }, []);

  const signOut = useCallback(() => {
    authSignOut();
    setUser(null);
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
