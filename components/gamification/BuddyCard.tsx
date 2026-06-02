"use client";

import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useProgression } from "@/contexts/progression-context";
import { UserAvatar } from "@/components/social/UserAvatar";
import { listFriends } from "@/lib/social/friends-service";
import { getMyProfile } from "@/lib/social/profile-service";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { profileHref, type Friend } from "@/lib/social/types";
import { timeAgo } from "@/lib/social/format";
import { Check, Copy, Heart, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function BuddyCard() {
  const { user } = useAuth();
  const { snapshot, pair, unpair } = useProgression();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [publicUid, setPublicUid] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseEnabled()) return;
    void listFriends().then(setFriends);
    void getMyProfile().then((p) => setPublicUid(p?.publicUid ?? null));
  }, [snapshot?.buddy?.buddyId]);

  if (!snapshot || !user) {
    return (
      <Card className="h-full animate-pulse p-5">
        <div className="h-20" />
      </Card>
    );
  }

  const buddy = snapshot.buddy;

  const handlePairUser = async (id: string) => {
    setBusy(true);
    setError(null);
    const res = await pair(id);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Could not pair.");
  };

  const handleUnpair = async () => {
    setBusy(true);
    setError(null);
    const res = await unpair();
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Could not unpair.");
  };

  const copyUid = async () => {
    const text = publicUid ?? user.id;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Card className="h-full border-emerald-400/20 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <Heart className="h-5 w-5 text-emerald-500" />
        Study buddy
      </div>
      <p className="mt-1 text-[11px] text-muted">
        One special partner. +20% XP when you both study the same day.
      </p>

      {buddy && buddy.status === "active" ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-3">
            <div className="flex items-start gap-3">
              <Link href={profileHref(buddy)} className="shrink-0">
                <UserAvatar
                  userId={buddy.buddyId}
                  displayName={buddy.buddyName}
                  avatarId={buddy.avatarId}
                  frameId={buddy.frameId}
                  size={48}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={profileHref(buddy)}
                  className="truncate text-sm font-semibold text-text hover:underline"
                >
                  {buddy.buddyName}
                </Link>
                <p className="truncate text-[11px] text-muted">
                  {buddy.username ? `@${buddy.username}` : buddy.publicUid || "Study buddy"}
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted">
                  <span>Lv {buddy.level}</span>
                  {buddy.currentStreak > 0 ? (
                    <span>{buddy.currentStreak}d streak</span>
                  ) : null}
                  {buddy.pairedSince ? (
                    <span>Buddy since {timeAgo(buddy.pairedSince)}</span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleUnpair()}
                disabled={busy}
                className="rounded-lg p-1.5 text-muted hover:bg-white/40 hover:text-alert dark:hover:bg-white/10"
                aria-label="Remove buddy"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              +20% XP bonus active when you both study today
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text">
                      {f.displayName}
                    </p>
                    <p className="truncate text-[10px] text-muted">
                      {f.username ? `@${f.username}` : f.publicUid}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handlePairUser(f.userId)}
                    disabled={busy}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    <UserPlus className="h-3 w-3" />
                    Pair
                  </button>
                </li>
              ))}
            </ul>
          ) : isSupabaseEnabled() ? (
            <p className="rounded-lg border border-white/45 bg-white/20 px-3 py-2 text-[11px] text-muted dark:border-white/10 dark:bg-white/[0.04]">
              Add friends first.{" "}
              <Link href="/friends" className="font-semibold text-primary">
                Find study partners
              </Link>{" "}
              — buddies must be friends.
            </p>
          ) : null}

          {error ? <p className="text-[11px] text-alert">{error}</p> : null}
          <button
            type="button"
            onClick={() => void copyUid()}
            className="flex items-center gap-1.5 text-[10px] text-muted hover:text-text"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied
              ? "Copied"
              : publicUid
                ? `Share your UID: ${publicUid}`
                : "Copy your user ID"}
          </button>
        </div>
      )}
    </Card>
  );
}
