"use client";

import type { LiveSessionSnapshot } from "@/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const defaultSnap: LiveSessionSnapshot = {
  running: false,
  phase: "focus",
  focusState: null,
  score: null,
};

type SessionLiveContextValue = {
  live: LiveSessionSnapshot;
  setLive: (u: Partial<LiveSessionSnapshot>) => void;
  resetLive: () => void;
};

const SessionLiveContext = createContext<SessionLiveContextValue | null>(null);

export function SessionLiveProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [live, setLiveState] = useState<LiveSessionSnapshot>(defaultSnap);

  const setLive = useCallback((u: Partial<LiveSessionSnapshot>) => {
    setLiveState((prev) => ({ ...prev, ...u }));
  }, []);

  const resetLive = useCallback(() => setLiveState(defaultSnap), []);

  const value = useMemo(
    () => ({ live, setLive, resetLive }),
    [live, setLive, resetLive],
  );

  return (
    <SessionLiveContext.Provider value={value}>
      {children}
    </SessionLiveContext.Provider>
  );
}

export function useSessionLive() {
  const ctx = useContext(SessionLiveContext);
  if (!ctx)
    throw new Error("useSessionLive must be used within SessionLiveProvider");
  return ctx;
}
