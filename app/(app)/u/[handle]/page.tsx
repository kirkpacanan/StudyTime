"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/social/UserAvatar";
import { RankChip } from "@/components/gamification/RankChip";
import { achievementIcon } from "@/components/gamification/icons";
import { ACHIEVEMENTS, type AchievementId } from "@/lib/gamification/achievements";
import { rankForLevel } from "@/lib/gamification/ranks";
import { getPublicProfile } from "@/lib/social/profile-service";
import {
  sendFriendRequest,
  removeFriend,
} from "@/lib/social/friends-service";
import { useProgression } from "@/contexts/progression-context";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import type { PublicProfileCard } from "@/lib/social/types";
import {
  ArrowLeft,
  Check,
  Clock,
  Flame,
  Lock,
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
  const { snapshot, pair, unpair } = useProgression();
  const [card, setCard] = useState<PublicProfileCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handle = decodeURIComponent(params.handle ?? "");

  const load = useCallback(async () => {
    if (!isSupabaseEnabled()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const isPublicUid = /^ST-/i.test(handle);
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        handle,
      );
    const result = await getPublicProfile(
      isUuid
        ? { userId: handle }
        : isPublicUid
          ? { publicUid: handle }
          : { username: handle },
    );
    setCard(result);
    setLoading(false);
  }, [handle]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAddFriend = async () => {
    if (!card) return;
    setBusy(true);
    const res = await sendFriendRequest(card.userId);
    setBusy(false);
    if (res.ok) {
      setNotice(
        res.status === "accepted" ? "You are now friends!" : "Friend request sent.",
      );
      void load();
    } else {
      setNotice(res.error);
    }
  };

  const onRemoveFriend = async () => {
    if (!card) return;
    setBusy(true);
    await removeFriend(card.userId);
    setBusy(false);
    setNotice("Friend removed.");
    void load();
  };

  const onSetBuddy = async () => {
    if (!card) return;
    setBusy(true);
    const res = await pair(card.userId);
    setBusy(false);
    setNotice(res.ok ? "Study buddy set!" : (res.error ?? "Could not set buddy."));
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
          <p className="text-sm font-medium text-text">User not found</p>
          <p className="mt-1 text-sm text-muted">
            No profile matches “{handle}”.
          </p>
        </Card>
      </ProfileShell>
    );
  }

  const rank = rankForLevel(card.level);
  const isSelf = card.relationship === "self";
  const isFriend = card.relationship === "friend";
  const currentBuddyId = snapshot?.buddy?.buddyId ?? null;
  const isYourBuddy = currentBuddyId === card.userId;
  const canSetBuddy = isFriend && !isSelf && !isYourBuddy;
  const pinned = card.loadout.pinnedBadges
    .filter((id): id is AchievementId => id in ACHIEVEMENTS)
    .slice(0, 3);

  return (
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
              <h1 className="text-xl font-semibold tracking-tight text-text">
                {card.displayName}
              </h1>
              <RankChip rank={rank} prestige={card.prestige} />
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {card.username ? `@${card.username}` : null}
              {card.username ? " · " : null}
              <span className="font-mono">{card.publicUid}</span>
            </p>
            {card.loadout.bio ? (
              <p className="mt-2 text-sm text-text">{card.loadout.bio}</p>
            ) : card.loadout.status ? (
              <p className="mt-2 text-sm italic text-muted">
                “{card.loadout.status}”
              </p>
            ) : null}

            {!isSelf ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {isFriend ? (
                  <Button variant="secondary" onClick={onRemoveFriend} disabled={busy}>
                    <UserMinus className="h-4 w-4" /> Remove friend
                  </Button>
                ) : card.allowFriendRequests ? (
                  <Button onClick={onAddFriend} disabled={busy}>
                    <UserPlus className="h-4 w-4" /> Add friend
                  </Button>
                ) : null}
                {canSetBuddy ? (
                  <Button variant="secondary" onClick={onSetBuddy} disabled={busy}>
                    <Users className="h-4 w-4" /> Set as study buddy
                  </Button>
                ) : null}
                {isYourBuddy ? (
                  <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    <Check className="h-4 w-4" /> Your study buddy
                  </span>
                ) : null}
              </div>
            ) : null}
            {notice ? (
              <p className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {notice}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {card.visible && card.stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Flame} label="Current streak" value={`${card.stats.currentStreak}d`} />
          <Stat icon={Trophy} label="Longest streak" value={`${card.stats.longestStreak}d`} />
          <Stat icon={Clock} label="Focus hours" value={`${card.stats.totalFocusHours}`} />
          <Stat icon={Users} label="Sessions" value={`${card.stats.sessionsCount}`} />
        </div>
      ) : (
        <Card className="flex items-center gap-3 text-sm text-muted">
          <Lock className="h-4 w-4" />
          {card.profileVisibility === "private"
            ? "This profile is private."
            : "Add this user as a friend to see their study stats."}
        </Card>
      )}

      {pinned.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-text">Pinned badges</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {pinned.map((id) => {
              const def = ACHIEVEMENTS[id];
              const Icon = achievementIcon(def.icon);
              return (
                <span
                  key={id}
                  title={def.description}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
                >
                  <Icon className="h-3.5 w-3.5" /> {def.title}
                </span>
              );
            })}
          </div>
        </Card>
      ) : null}
    </ProfileShell>
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
