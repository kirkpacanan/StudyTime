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
  /** Destination the user tried to navigate to while a session was running.
   *  "__logout__" is the special token for the logout action. */
  pendingNavDestination: string | null;
  /** Called by Sidebar/Topbar to request navigation away from an active session. */
  requestNavAway: (destination: string) => void;
  /** Called by the session page once it has handled the pending destination. */
  clearPendingNav: () => void;
};

const SessionLiveContext = createContext<SessionLiveContextValue | null>(null);

export function SessionLiveProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [live, setLiveState] = useState<LiveSessionSnapshot>(defaultSnap);
  const [pendingNavDestination, setPendingNavDestination] = useState<string | null>(null);

  const setLive = useCallback((u: Partial<LiveSessionSnapshot>) => {
    setLiveState((prev) => ({ ...prev, ...u }));
  }, []);

  const resetLive = useCallback(() => setLiveState(defaultSnap), []);

  const requestNavAway = useCallback((destination: string) => {
    setPendingNavDestination(destination);
  }, []);

  const clearPendingNav = useCallback(() => {
    setPendingNavDestination(null);
  }, []);

  const value = useMemo(
    () => ({ live, setLive, resetLive, pendingNavDestination, requestNavAway, clearPendingNav }),
    [live, setLive, resetLive, pendingNavDestination, requestNavAway, clearPendingNav],
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
