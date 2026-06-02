"use client";

import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useProgression } from "@/contexts/progression-context";
import { PlayerAvatar } from "@/components/gamification/PlayerAvatar";
import { UserAvatar } from "@/components/social/UserAvatar";
import { listFriends } from "@/lib/social/friends-service";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import type { Friend } from "@/lib/social/types";
import { Check, ChevronDown, Copy, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function BuddyCard() {
  const { user } = useAuth();
  const { snapshot, pair, unpair } = useProgression();
  const [buddyId, setBuddyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!isSupabaseEnabled()) return;
    void listFriends().then(setFriends);
  }, []);

  if (!snapshot || !user) {
    return (
      <Card className="h-full animate-pulse p-5">
        <div className="h-20" />
      </Card>
    );
  }

  const buddy = snapshot.buddy;

  const handlePair = async () => {
    if (!buddyId.trim()) return;
    setBusy(true);
    setError(null);
    const res = await pair(buddyId);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Could not pair.");
    else setBuddyId("");
  };

  const handlePairUser = async (id: string) => {
    setBusy(true);
    setError(null);
    const res = await pair(id);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Could not pair.");
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Card className="h-full p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <Users className="h-5 w-5 text-emerald-500" />
        Study buddy
      </div>

      {buddy && buddy.status === "active" ? (
        <div className="mt-3">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
            <PlayerAvatar
              seed={buddy.buddyId + buddy.buddyName}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">
                {buddy.buddyName}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                +20% XP when you both study today
              </p>
            </div>
            <button
              type="button"
              onClick={() => void unpair()}
              className="rounded-lg p-1.5 text-muted hover:bg-white/40 hover:text-alert dark:hover:bg-white/10"
              aria-label="Remove buddy"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-muted">
            Pick a friend as your study buddy to share a streak and earn a +20%
            XP bonus on days you both study.
          </p>

          {friends.length > 0 ? (
            <ul className="max-h-44 space-y-1 overflow-y-auto">
              {friends.map((f) => (
                <li
                  key={f.userId}
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-white/30 dark:hover:bg-white/[0.06]"
                >
                  <UserAvatar
                    userId={f.userId}
                    displayName={f.displayName}
                    avatarId={f.avatarId}
                    frameId={f.frameId}
                    size={32}
                    presence={f.presenceStatus}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-text">
                    {f.displayName}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handlePairUser(f.userId)}
                    disabled={busy}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    <UserPlus className="h-3 w-3" />
                    Set
                  </button>
                </li>
              ))}
            </ul>
          ) : isSupabaseEnabled() ? (
            <p className="rounded-lg border border-white/45 bg-white/20 px-3 py-2 text-[11px] text-muted dark:border-white/10 dark:bg-white/[0.04]">
              No friends yet.{" "}
              <Link href="/friends" className="font-semibold text-primary">
                Find study partners
              </Link>{" "}
              to set a buddy.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="flex items-center gap-1 text-[10px] font-medium text-muted hover:text-text"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
            />
            Pair by user ID
          </button>

          {showAdvanced ? (
            <div className="flex gap-2">
              <input
                value={buddyId}
                onChange={(e) => setBuddyId(e.target.value)}
                placeholder="Buddy user ID"
                className="glass-input min-w-0 flex-1 px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => void handlePair()}
                disabled={busy || !buddyId.trim()}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Pair
              </button>
            </div>
          ) : null}

          {error ? <p className="text-[11px] text-alert">{error}</p> : null}
          <button
            type="button"
            onClick={() => void copyId()}
            className="flex items-center gap-1.5 text-[10px] text-muted hover:text-text"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Copied your ID" : "Copy your user ID"}
          </button>
        </div>
      )}
    </Card>
  );
}
