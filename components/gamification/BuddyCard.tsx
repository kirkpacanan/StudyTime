"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useProgression } from "@/contexts/progression-context";
import { UserAvatar } from "@/components/social/UserAvatar";
import {
  UnpairBuddyConfirmModal,
  type UnpairBuddyTarget,
} from "@/components/social/UnpairBuddyConfirmModal";
import { listFriends } from "@/lib/social/friends-service";
import { getMyProfile } from "@/lib/social/profile-service";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { profileHref, type Friend } from "@/lib/social/types";
import { timeAgo } from "@/lib/social/format";
import { Check, Clock, Copy, Heart, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "pending" | "active";
}) {
  const styles = {
    neutral: "border-white/45 bg-white/20 text-muted dark:border-white/10 dark:bg-white/[0.04]",
    pending: "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    active: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {tone === "pending" ? <Clock className="h-3 w-3" /> : null}
      {tone === "active" ? <Heart className="h-3 w-3" /> : null}
      {label}
    </span>
  );
}

export function BuddyCard() {
  const { user } = useAuth();
  const { snapshot, pair, respondBuddyRequest, cancelBuddyRequest, unpair } =
    useProgression();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [publicUid, setPublicUid] = useState<string | null>(null);
  const [unpairTarget, setUnpairTarget] = useState<UnpairBuddyTarget | null>(null);
  const [unpairBusy, setUnpairBusy] = useState(false);
  const [unpairError, setUnpairError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseEnabled()) return;
    void listFriends().then(setFriends);
    void getMyProfile().then((p) => setPublicUid(p?.publicUid ?? null));
  }, [snapshot?.buddy?.buddyId, snapshot?.buddy?.status]);

  if (!snapshot || !user) {
    return (
      <Card className="h-full animate-pulse p-5">
        <div className="h-20" />
      </Card>
    );
  }

  const buddy = snapshot.buddy;
  const hasActiveBuddy = buddy?.status === "active";
  const hasPendingOut = buddy?.status === "pending_out";
  const hasPendingIn = buddy?.status === "pending_in";

  const handleSendRequest = async (id: string) => {
    setBusy(true);
    setError(null);
    const res = await pair(id);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Could not send request.");
  };

  const handleRespond = async (accept: boolean) => {
    if (!buddy?.requestId) return;
    setBusy(true);
    setError(null);
    const res = await respondBuddyRequest(buddy.requestId, accept);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Could not respond to request.");
  };

  const handleCancelRequest = async () => {
    if (!buddy?.requestId) return;
    setBusy(true);
    setError(null);
    const res = await cancelBuddyRequest(buddy.requestId);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Could not cancel request.");
  };

  const handleConfirmUnpair = async () => {
    setUnpairBusy(true);
    setUnpairError(null);
    const res = await unpair();
    setUnpairBusy(false);
    if (res.ok) {
      setUnpairTarget(null);
    } else {
      setUnpairError(res.error ?? "Could not remove study buddy.");
    }
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

  const statusLabel = hasActiveBuddy
    ? "Active Study Buddy"
    : hasPendingOut
      ? "Request Sent"
      : hasPendingIn
        ? "Request Received"
        : "No Study Buddy";

  const statusTone = hasActiveBuddy ? "active" : hasPendingOut || hasPendingIn ? "pending" : "neutral";

  return (
    <>
      <Card className="h-full border-emerald-400/20 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-text">
            <Heart className="h-5 w-5 text-emerald-500" />
            Study buddy
          </div>
          <StatusPill label={statusLabel} tone={statusTone} />
        </div>
        <p className="mt-1 text-[11px] text-muted">
          One special partner. +20% XP when you both study the same day.
        </p>

        {hasActiveBuddy && buddy ? (
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
                  onClick={() =>
                    setUnpairTarget({
                      userId: buddy.buddyId,
                      displayName: buddy.buddyName,
                      username: buddy.username,
                      publicUid: buddy.publicUid,
                    })
                  }
                  disabled={busy || unpairBusy}
                  className="rounded-lg p-1.5 text-muted hover:bg-white/40 hover:text-alert dark:hover:bg-white/10"
                  aria-label="Remove study buddy"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                +20% XP bonus active when you both study today
              </p>
            </div>
          </div>
        ) : hasPendingOut && buddy ? (
          <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/5 p-3">
            <div className="flex items-start gap-3">
              <UserAvatar
                userId={buddy.buddyId}
                displayName={buddy.buddyName}
                avatarId={buddy.avatarId}
                frameId={buddy.frameId}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text">
                  Waiting for {buddy.buddyName}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Request sent {buddy.requestedAt ? timeAgo(buddy.requestedAt) : "recently"}.
                  They must accept before you become study buddies.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2 h-8 px-3 text-[11px]"
                  onClick={() => void handleCancelRequest()}
                  disabled={busy}
                >
                  Cancel request
                </Button>
              </div>
            </div>
          </div>
        ) : hasPendingIn && buddy ? (
          <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
            <div className="flex items-start gap-3">
              <UserAvatar
                userId={buddy.buddyId}
                displayName={buddy.buddyName}
                avatarId={buddy.avatarId}
                frameId={buddy.frameId}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text">
                  {buddy.buddyName} wants to be your study buddy
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Accept to unlock the +20% XP bonus when you both study.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    className="h-8 flex-1 px-3 text-[11px]"
                    onClick={() => void handleRespond(true)}
                    disabled={busy}
                  >
                    <Check className="h-3 w-3" /> Accept
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 flex-1 px-3 text-[11px]"
                    onClick={() => void handleRespond(false)}
                    disabled={busy}
                  >
                    <X className="h-3 w-3" /> Decline
                  </Button>
                </div>
              </div>
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
                      onClick={() => void handleSendRequest(f.userId)}
                      disabled={busy}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                    >
                      <UserPlus className="h-3 w-3" />
                      Request
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

        {error && (hasActiveBuddy || hasPendingOut || hasPendingIn) ? (
          <p className="mt-2 text-[11px] text-alert">{error}</p>
        ) : null}
      </Card>

      <UnpairBuddyConfirmModal
        open={unpairTarget != null}
        target={unpairTarget}
        busy={unpairBusy}
        error={unpairError}
        onConfirm={() => void handleConfirmUnpair()}
        onCancel={() => {
          if (!unpairBusy) {
            setUnpairTarget(null);
            setUnpairError(null);
          }
        }}
      />
    </>
  );
}
