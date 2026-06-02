"use client";

import { useAuth } from "@/hooks/useAuth";
import type { CosmeticType } from "@/lib/gamification/cosmetics";
import type { AchievementId } from "@/lib/gamification/achievements";
import type { ProfileLoadout } from "@/lib/gamification/profile";
import {
  loadProgressionSnapshot,
  performPrestige,
  type ProgressionSnapshot,
} from "@/lib/gamification/progression-service";
import {
  getLoadout,
  pairBuddy,
  saveLoadout,
  unpairBuddy,
} from "@/lib/gamification/progression-storage";
import { emitActivity } from "@/lib/social/feed-service";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ProgressionContextValue = {
  snapshot: ProgressionSnapshot | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateLoadout: (partial: Partial<ProfileLoadout>) => Promise<void>;
  equipCosmetic: (type: CosmeticType, id: string) => Promise<void>;
  togglePinnedBadge: (id: AchievementId) => Promise<void>;
  equipTitle: (titleId: string | null) => Promise<void>;
  pair: (buddyId: string) => Promise<{ ok: boolean; error?: string }>;
  unpair: () => Promise<void>;
  prestige: () => Promise<{ ok: boolean; error?: string }>;
};

const ProgressionContext = createContext<ProgressionContextValue | null>(null);

export function ProgressionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<ProgressionSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const userId = user?.id ?? null;
  const loadGen = useRef(0);

  const refresh = useCallback(async () => {
    const gen = ++loadGen.current;
    // Defer so state updates never run synchronously inside an effect body.
    await Promise.resolve();
    if (gen !== loadGen.current) return;
    if (!userId) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await loadProgressionSnapshot(userId);
      if (gen === loadGen.current) setSnapshot(snap);
    } catch {
      if (gen === loadGen.current) setSnapshot(null);
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, [userId]);

  // Initial / user-change load. State is set inside the promise callback (not
  // synchronously in the effect body) to avoid cascading renders.
  useEffect(() => {
    let cancelled = false;
    const run = userId
      ? loadProgressionSnapshot(userId)
      : Promise.resolve(null);
    void run
      .then((snap) => {
        if (!cancelled) setSnapshot(snap);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const updateLoadout = useCallback(
    async (partial: Partial<ProfileLoadout>) => {
      if (!userId) return;
      const current = snapshot?.loadout ?? (await getLoadout(userId));
      const next: ProfileLoadout = { ...current, ...partial };
      await saveLoadout(userId, next);
      setSnapshot((prev) => (prev ? { ...prev, loadout: next } : prev));
    },
    [userId, snapshot?.loadout],
  );

  const equipCosmetic = useCallback(
    async (type: CosmeticType, id: string) => {
      const key =
        type === "avatar" ? "avatarId" : type === "frame" ? "frameId" : "themeId";
      await updateLoadout({ [key]: id } as Partial<ProfileLoadout>);
    },
    [updateLoadout],
  );

  const togglePinnedBadge = useCallback(
    async (id: AchievementId) => {
      const current = snapshot?.loadout.pinnedBadges ?? [];
      let next: AchievementId[];
      if (current.includes(id)) {
        next = current.filter((b) => b !== id);
      } else {
        next = [...current, id].slice(-3);
      }
      await updateLoadout({ pinnedBadges: next });
    },
    [snapshot?.loadout.pinnedBadges, updateLoadout],
  );

  const equipTitle = useCallback(
    async (titleId: string | null) => {
      await updateLoadout({ titleId });
    },
    [updateLoadout],
  );

  const pair = useCallback(
    async (buddyId: string) => {
      if (!userId) return { ok: false, error: "Not signed in." };
      const res = await pairBuddy(userId, buddyId.trim());
      if (res.ok) {
        void emitActivity("buddy_paired", { objectType: "user", objectId: buddyId.trim() });
        await refresh();
      }
      return res;
    },
    [userId, refresh],
  );

  const unpair = useCallback(async () => {
    if (!userId) return;
    await unpairBuddy(userId);
    await refresh();
  }, [userId, refresh]);

  const prestige = useCallback(async () => {
    if (!userId) return { ok: false, error: "Not signed in." };
    const res = await performPrestige(userId);
    if (res.ok) await refresh();
    return { ok: res.ok, error: res.error };
  }, [userId, refresh]);

  const value = useMemo(
    () => ({
      snapshot,
      loading,
      refresh,
      updateLoadout,
      equipCosmetic,
      togglePinnedBadge,
      equipTitle,
      pair,
      unpair,
      prestige,
    }),
    [
      snapshot,
      loading,
      refresh,
      updateLoadout,
      equipCosmetic,
      togglePinnedBadge,
      equipTitle,
      pair,
      unpair,
      prestige,
    ],
  );

  return (
    <ProgressionContext.Provider value={value}>
      {children}
    </ProgressionContext.Provider>
  );
}

export function useProgression() {
  const ctx = useContext(ProgressionContext);
  if (!ctx)
    throw new Error("useProgression must be used within ProgressionProvider");
  return ctx;
}
