"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/social/UserAvatar";
import { RelationshipBadge } from "@/components/social/RelationshipBadge";
import { UnfriendConfirmModal } from "@/components/social/UnfriendConfirmModal";
import { UnpairBuddyConfirmModal } from "@/components/social/UnpairBuddyConfirmModal";
import { RankChip } from "@/components/gamification/RankChip";
import { PinnedAchievementBadge } from "@/components/gamification/PinnedAchievementBadge";
import { ACHIEVEMENTS, type AchievementId } from "@/lib/gamification/achievements";
import { rankForLevel } from "@/lib/gamification/ranks";
import { getPublicProfile } from "@/lib/social/profile-service";
import {
  sendFriendRequest,
  removeFriend,
  blockUser,
  listFriendRequests,
  respondFriendRequest,
} from "@/lib/social/friends-service";
import { useProgression } from "@/contexts/progression-context";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { profileHref, type PublicProfileCard } from "@/lib/social/types";
import { timeAgo } from "@/lib/social/format";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Flame,
  Heart,
  Lock,
  ShieldBan,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function PublicProfilePage() {
  const params = useParams<{ handle: string }>();
  const router = useRouter();
  const { snapshot, pair, respondBuddyRequest, cancelBuddyRequest, unpair } =
    useProgression();
  const [card, setCard] = useState<PublicProfileCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incomingRequestId, setIncomingRequestId] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);
  const [showUnfriendModal, setShowUnfriendModal] = useState(false);
  const [unfriendBusy, setUnfriendBusy] = useState(false);
  const [showUnpairModal, setShowUnpairModal] = useState(false);
  const [unpairBusy, setUnpairBusy] = useState(false);

  const handle = decodeURIComponent(params.handle ?? "");

  const load = useCallback(async () => {
    if (!isSupabaseEnabled()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const isPublicUid = /^ST-/i.test(handle);
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        handle,
      );
    const { profile: result, error: loadError } = await getPublicProfile(
      isUuid
        ? { userId: handle }
        : isPublicUid
          ? { publicUid: handle }
          : { username: handle },
    );
    setCard(result);
    if (loadError) setError(loadError);
    if (result && result.relationship === "pending_in") {
      const inbox = await listFriendRequests(true);
      const match = inbox.find((r) => r.userId === result.userId);
      setIncomingRequestId(match?.requestId ?? null);
    } else {
      setIncomingRequestId(null);
    }
    setLoading(false);
  }, [handle]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyUid = async (uid: string) => {
    try {
      await navigator.clipboard.writeText(uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 1500);
    } catch {
      setError("Could not copy UID.");
    }
  };

  const onAddFriend = async () => {
    if (!card) return;
    setBusy(true);
    setError(null);
    const res = await sendFriendRequest(card.userId);
    setBusy(false);
    if (res.ok) {
      setNotice(
        res.status === "accepted" ? "You are now friends!" : "Friend request sent.",
      );
      void load();
    } else {
      setError(res.error);
    }
  };

  const onAcceptRequest = async () => {
    if (!incomingRequestId) return;
    setBusy(true);
    setError(null);
    const res = await respondFriendRequest(incomingRequestId, true);
    setBusy(false);
    if (res.ok) {
      setNotice("You are now friends!");
      void load();
    } else {
      setError(res.error);
    }
  };

  const onRemoveFriend = () => {
    if (!card) return;
    setError(null);
    setShowUnfriendModal(true);
  };

  const executeUnfriend = async () => {
    if (!card) return;
    setUnfriendBusy(true);
    setError(null);
    const name = card.displayName;
    const res = await removeFriend(card.userId);
    setUnfriendBusy(false);
    if (res.ok) {
      setShowUnfriendModal(false);
      setNotice(`${name} has been removed from your friends.`);
      void load();
    } else {
      setError(res.error);
    }
  };

  const onBlock = async () => {
    if (!card) return;
    setBusy(true);
    setError(null);
    const res = await blockUser(card.userId);
    setBusy(false);
    if (res.ok) {
      setNotice("User blocked.");
      void load();
    } else {
      setError(res.error);
    }
  };

  const onSendBuddyRequest = async () => {
    if (!card) return;
    setBusy(true);
    setError(null);
    const res = await pair(card.userId);
    setBusy(false);
    if (res.ok) {
      setNotice("Study buddy request sent!");
      void load();
    } else {
      setError(res.error ?? "Could not send request.");
    }
  };

  const onAcceptBuddyRequest = async () => {
    const requestId = snapshot?.buddy?.requestId;
    if (!requestId) return;
    setBusy(true);
    setError(null);
    const res = await respondBuddyRequest(requestId, true);
    setBusy(false);
    if (res.ok) {
      setNotice("Study buddy request accepted!");
      void load();
    } else {
      setError(res.error ?? "Could not accept request.");
    }
  };

  const onDeclineBuddyRequest = async () => {
    const requestId = snapshot?.buddy?.requestId;
    if (!requestId) return;
    setBusy(true);
    setError(null);
    const res = await respondBuddyRequest(requestId, false);
    setBusy(false);
    if (res.ok) {
      setNotice("Study buddy request declined.");
      void load();
    } else {
      setError(res.error ?? "Could not decline request.");
    }
  };

  const onCancelBuddyRequest = async () => {
    const requestId = snapshot?.buddy?.requestId;
    if (!requestId) return;
    setBusy(true);
    setError(null);
    const res = await cancelBuddyRequest(requestId);
    setBusy(false);
    if (res.ok) {
      setNotice("Study buddy request canceled.");
      void load();
    } else {
      setError(res.error ?? "Could not cancel request.");
    }
  };

  const onUnpairBuddy = () => {
    setError(null);
    setShowUnpairModal(true);
  };

  const executeUnpairBuddy = async () => {
    setUnpairBusy(true);
    setError(null);
    const res = await unpair();
    setUnpairBusy(false);
    if (res.ok) {
      setShowUnpairModal(false);
      setNotice("Study buddy removed.");
      void load();
    } else {
      setError(res.error ?? "Could not remove study buddy.");
    }
  };

  if (!isSupabaseEnabled()) {
    return (
      <ProfileShell>
        <Card className="text-center">
          <p className="text-sm text-muted">
            Public profiles require a cloud account. Configure Supabase to use
            social features.
          </p>
        </Card>
      </ProfileShell>
    );
  }

  if (loading) {
    return (
      <ProfileShell>
        <Card className="h-48 animate-pulse" />
      </ProfileShell>
    );
  }

  if (!card) {
    return (
      <ProfileShell>
        <Card className="text-center">
          {error ? (
            <>
              <p className="text-sm font-medium text-alert">Could not load profile</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">{error}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-text">User not found</p>
              <p className="mt-1 text-sm text-muted">
                No profile matches “{handle}”.
              </p>
            </>
          )}
        </Card>
      </ProfileShell>
    );
  }

  const rank = rankForLevel(card.level);
  const isSelf = card.relationship === "self";
  const isFriend = card.relationship === "friend";
  const isPendingIn = card.relationship === "pending_in";
  const isPendingOut = card.relationship === "pending_out";
  const isBlocked =
    card.relationship === "blocked" || card.relationship === "blocked_by";
  const buddyState = snapshot?.buddy ?? null;
  const hasActiveBuddy = buddyState?.status === "active";
  const hasPendingOut = buddyState?.status === "pending_out";
  const hasPendingIn = buddyState?.status === "pending_in";
  const isYourBuddy = hasActiveBuddy && buddyState?.buddyId === card.userId;
  const buddyRequestToThisUser =
    hasPendingOut && buddyState?.buddyId === card.userId;
  const buddyRequestFromThisUser =
    hasPendingIn && buddyState?.buddyId === card.userId;
  const canSendBuddyRequest =
    isFriend &&
    !isSelf &&
    !isYourBuddy &&
    !hasActiveBuddy &&
    !hasPendingOut &&
    !buddyRequestToThisUser &&
    !buddyRequestFromThisUser;
  const pinned = card.loadout.pinnedBadges
    .filter((id): id is AchievementId => id in ACHIEVEMENTS)
    .slice(0, 3);

  return (
    <>
    <ProfileShell>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <UserAvatar
            userId={card.userId}
            displayName={card.displayName}
            avatarId={card.loadout.avatarId}
            frameId={card.loadout.frameId}
            size={88}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">
                {card.displayName}
              </h1>
              <RankChip rank={rank} prestige={card.prestige} />
              {!isSelf ? (
                <RelationshipBadge relationship={card.relationship} />
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {card.username ? (
                <span className="font-medium text-text">@{card.username}</span>
              ) : null}
              <button
                type="button"
                onClick={() => void copyUid(card.publicUid)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/45 bg-white/30 px-2 py-0.5 font-mono text-xs font-semibold text-text transition hover:bg-white/50 dark:border-white/10 dark:bg-white/[0.05]"
                title="Copy UID"
              >
                {copiedUid ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3 text-muted" />
                )}
                {card.publicUid}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {card.friendCount} {card.friendCount === 1 ? "friend" : "friends"}
              </span>
              <span>Lv {card.level}</span>
              <span>
                Member since{" "}
                {new Date(card.memberSince).toLocaleDateString(undefined, {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>

            {card.loadout.bio ? (
              <p className="mt-3 text-sm text-text">{card.loadout.bio}</p>
            ) : card.loadout.status ? (
              <p className="mt-3 text-sm italic text-muted">
                “{card.loadout.status}”
              </p>
            ) : null}

            {!isSelf && !isBlocked ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {isFriend ? (
                  <Button variant="secondary" onClick={onRemoveFriend} disabled={busy || unfriendBusy}>
                    <UserMinus className="h-4 w-4" /> Remove friend
                  </Button>
                ) : isPendingIn ? (
                  <Button onClick={onAcceptRequest} disabled={busy || !incomingRequestId}>
                    <Check className="h-4 w-4" /> Accept request
                  </Button>
                ) : isPendingOut ? (
                  <Button variant="secondary" disabled>
                    Request sent
                  </Button>
                ) : card.allowFriendRequests ? (
                  <Button onClick={onAddFriend} disabled={busy}>
                    <UserPlus className="h-4 w-4" /> Add friend
                  </Button>
                ) : null}
                {canSendBuddyRequest ? (
                  <Button variant="secondary" onClick={onSendBuddyRequest} disabled={busy}>
                    <Heart className="h-4 w-4" /> Add study buddy
                  </Button>
                ) : null}
                {buddyRequestToThisUser ? (
                  <Button variant="secondary" onClick={onCancelBuddyRequest} disabled={busy}>
                    <Clock className="h-4 w-4" /> Request sent
                  </Button>
                ) : null}
                {buddyRequestFromThisUser ? (
                  <>
                    <Button onClick={onAcceptBuddyRequest} disabled={busy}>
                      <Check className="h-4 w-4" /> Accept buddy
                    </Button>
                    <Button variant="secondary" onClick={onDeclineBuddyRequest} disabled={busy}>
                      Decline
                    </Button>
                  </>
                ) : null}
                {isYourBuddy ? (
                  <Button variant="secondary" onClick={onUnpairBuddy} disabled={busy || unpairBusy}>
                    <Users className="h-4 w-4" /> Remove buddy
                  </Button>
                ) : null}
                {hasActiveBuddy && !isYourBuddy && isFriend ? (
                  <Button variant="secondary" disabled title="Only one active study buddy is allowed">
                    <Heart className="h-4 w-4" /> Add study buddy
                  </Button>
                ) : null}
                {!isFriend && !isPendingIn && !isPendingOut ? (
                  <Button variant="secondary" onClick={onBlock} disabled={busy}>
                    <ShieldBan className="h-4 w-4" /> Block
                  </Button>
                ) : null}
              </div>
            ) : null}

            {hasActiveBuddy && !isYourBuddy && isFriend ? (
              <p className="mt-3 text-xs text-muted">
                You already have an active study buddy. Remove your current buddy
                before pairing with someone else.
              </p>
            ) : null}
            {error ? (
              <p className="mt-3 text-xs font-medium text-alert">{error}</p>
            ) : null}
            {notice ? (
              <p className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {notice}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {card.studyBuddy ? (
        <Card className="border-emerald-400/30 bg-emerald-500/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-text">
            <Heart className="h-4 w-4 text-emerald-500" />
            Study buddy
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Link href={profileHref(card.studyBuddy)} className="shrink-0">
              <UserAvatar
                userId={card.studyBuddy.buddyId}
                displayName={card.studyBuddy.displayName}
                avatarId={card.studyBuddy.avatarId}
                frameId={card.studyBuddy.frameId}
                size={48}
              />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={profileHref(card.studyBuddy)}
                className="truncate text-sm font-semibold text-text hover:underline"
              >
                {card.studyBuddy.displayName}
              </Link>
              <p className="truncate text-xs text-muted">
                {card.studyBuddy.username
                  ? `@${card.studyBuddy.username}`
                  : card.studyBuddy.publicUid}{" "}
                · Lv {card.studyBuddy.level}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                Paired {timeAgo(card.studyBuddy.pairedSince)}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {card.visible && card.stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Flame} label="Current streak" value={`${card.stats.currentStreak}d`} />
          <Stat icon={Trophy} label="Longest streak" value={`${card.stats.longestStreak}d`} />
          <Stat icon={Clock} label="Focus hours" value={`${card.stats.totalFocusHours}`} />
          <Stat icon={Users} label="Sessions" value={`${card.stats.sessionsCount}`} />
        </div>
      ) : (
        <Card className="flex items-center gap-3 text-sm text-muted">
          <Lock className="h-4 w-4 shrink-0" />
          {card.profileVisibility === "private"
            ? "This profile is private."
            : "Add this user as a friend to see their study stats."}
        </Card>
      )}

      {pinned.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-text">Pinned badges</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {pinned.map((id) => (
              <PinnedAchievementBadge key={id} id={id} showTitle />
            ))}
          </div>
        </Card>
      ) : null}
    </ProfileShell>

    <UnfriendConfirmModal
      open={showUnfriendModal}
      target={
        card
          ? {
              userId: card.userId,
              displayName: card.displayName,
              username: card.username,
              publicUid: card.publicUid,
            }
          : null
      }
      busy={unfriendBusy}
      error={showUnfriendModal ? error : null}
      onConfirm={() => void executeUnfriend()}
      onCancel={() => {
        if (unfriendBusy) return;
        setShowUnfriendModal(false);
        setError(null);
      }}
    />

    <UnpairBuddyConfirmModal
      open={showUnpairModal}
      target={
        buddyState?.status === "active"
          ? {
              userId: buddyState.buddyId,
              displayName: buddyState.buddyName,
              username: buddyState.username,
              publicUid: buddyState.publicUid,
            }
          : card && isYourBuddy
            ? {
                userId: card.userId,
                displayName: card.displayName,
                username: card.username,
                publicUid: card.publicUid,
              }
            : null
      }
      busy={unpairBusy}
      error={showUnpairModal ? error : null}
      onConfirm={() => void executeUnpairBuddy()}
      onCancel={() => {
        if (unpairBusy) return;
        setShowUnpairModal(false);
        setError(null);
      }}
    />
    </>
  );

  function ProfileShell({ children }: { children: React.ReactNode }) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        {children}
        <p className="text-center text-xs text-muted">
          <Link href="/leaderboard" className="hover:text-text">
            Browse the leaderboard
          </Link>
        </p>
      </div>
    );
  }
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <Icon className="h-4 w-4 text-muted" />
      <p className="mt-2 text-lg font-semibold tabular-nums text-text">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </Card>
  );
}
