"use client";

import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useProgression } from "@/contexts/progression-context";
import { PlayerAvatar } from "@/components/gamification/PlayerAvatar";
import { Check, Copy, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";

export function BuddyCard() {
  const { user } = useAuth();
  const { snapshot, pair, unpair } = useProgression();
  const [buddyId, setBuddyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
            Pair with a friend by their user ID to share a streak and earn a +20%
            XP bonus on days you both study.
          </p>
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
