"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivityFeedPanel } from "@/components/social/ActivityFeedPanel";
import { UserAvatar } from "@/components/social/UserAvatar";
import { SearchModal } from "@/components/social/SearchModal";
import { UnfriendConfirmModal, type UnfriendTarget } from "@/components/social/UnfriendConfirmModal";
import { usePresence } from "@/contexts/presence-context";
import {
  listFriends,
  listFriendRequests,
  respondFriendRequest,
  removeFriend,
  cancelFriendRequest,
} from "@/lib/social/friends-service";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { profileHref, type Friend, type FriendRequest } from "@/lib/social/types";
import { cn } from "@/lib/cn";
import { Check, Flame, Search, UserMinus, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Tab = "activity" | "friends" | "requests";

function parseTab(param: string | null): Tab {
  if (param === "activity" || param === "requests") return param;
  return "friends";
}

export default function FriendsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const { friends: livePresence } = usePresence();

  const setTab = useCallback(
    (next: Tab) => {
      const href = next === "friends" ? "/friends" : `/friends?tab=${next}`;
      router.replace(href, { scroll: false });
    },
    [router],
  );
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inbox, setInbox] = useState<FriendRequest[]>([]);
  const [outbox, setOutbox] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [unfriendTarget, setUnfriendTarget] = useState<UnfriendTarget | null>(null);
  const [unfriendBusy, setUnfriendBusy] = useState(false);
  const successTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseEnabled()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [f, i, o] = await Promise.all([
      listFriends(),
      listFriendRequests(true),
      listFriendRequests(false),
    ]);
    setFriends(f);
    setInbox(i);
    setOutbox(o);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current != null) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const showSuccess = useCallback((message: string) => {
    setSuccess(message);
    if (successTimerRef.current != null) {
      window.clearTimeout(successTimerRef.current);
    }
    successTimerRef.current = window.setTimeout(() => {
      setSuccess(null);
      successTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    if (!isSupabaseEnabled()) return;
    let channel: ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | null =
      null;
    try {
      const supabase = getSupabaseBrowser();
      channel = supabase
        .channel("friends-graph")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "friend_requests" },
          () => void refresh(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "friends" },
          () => void refresh(),
        )
        .subscribe();
    } catch {
      /* realtime optional */
    }
    return () => {
      if (channel) {
        try {
          void getSupabaseBrowser().removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [refresh]);

  const respond = async (id: string, accept: boolean) => {
    setError(null);
    const res = await respondFriendRequest(id, accept);
    if (!res.ok) setError(res.error);
    await refresh();
  };

  const cancel = async (id: string) => {
    setError(null);
    const res = await cancelFriendRequest(id);
    if (!res.ok) setError(res.error);
    await refresh();
  };

  const confirmUnfriend = (friend: Friend) => {
    setError(null);
    setUnfriendTarget({
      userId: friend.userId,
      displayName: friend.displayName,
      username: friend.username,
      publicUid: friend.publicUid,
    });
  };

  const cancelUnfriend = () => {
    if (unfriendBusy) return;
    setUnfriendTarget(null);
    setError(null);
  };

  const executeUnfriend = async () => {
    if (!unfriendTarget) return;
    setUnfriendBusy(true);
    setError(null);
    const name = unfriendTarget.displayName;
    const res = await removeFriend(unfriendTarget.userId);
    setUnfriendBusy(false);
    if (res.ok) {
      setUnfriendTarget(null);
      showSuccess(`${name} has been removed from your friends.`);
      await refresh();
    } else {
      setError(res.error);
    }
  };

  if (!isSupabaseEnabled()) {
    return (
      <div className="space-y-6">
        <Header onSearch={() => setSearchOpen(true)} />
        <Card className="text-center text-sm text-muted">
          Social features require a cloud account. Configure Supabase to connect
          with other students.
        </Card>
      </div>
    );
  }

  const friendsWithPresence = friends.map((f) => ({
    ...f,
    presenceStatus: livePresence[f.userId] ?? f.presenceStatus,
  }));

  const studyingCount = friendsWithPresence.filter(
    (f) => f.presenceStatus === "studying",
  ).length;

  return (
    <div className="space-y-6">
      <Header onSearch={() => setSearchOpen(true)} studyingCount={studyingCount} />

      {error && !unfriendTarget ? (
        <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p
          className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
          role="status"
        >
          {success}
        </p>
      ) : null}

      <div className="flex gap-1 rounded-xl border border-white/45 bg-white/30 p-1 dark:border-white/10 dark:bg-white/[0.05]">
        <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>
          Activity
        </TabButton>
        <TabButton active={tab === "friends"} onClick={() => setTab("friends")}>
          Friends ({friends.length})
        </TabButton>
        <TabButton active={tab === "requests"} onClick={() => setTab("requests")}>
          Requests {inbox.length > 0 ? `(${inbox.length})` : ""}
        </TabButton>
      </div>

      {tab === "activity" ? (
        <ActivityFeedPanel onFindPeople={() => setSearchOpen(true)} />
      ) : loading ? (
        <Card className="h-32 animate-pulse" />
      ) : tab === "friends" ? (
        friendsWithPresence.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No friends yet"
            body="Find study partners by name, @username, or their ST- UID."
            action={
              <Button onClick={() => setSearchOpen(true)}>
                <Search className="h-4 w-4" /> Find people
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {friendsWithPresence.map((f) => (
              <Card key={f.userId} className="flex items-center gap-3 p-3">
                <Link href={profileHref(f)} className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar
                    userId={f.userId}
                    displayName={f.displayName}
                    avatarId={f.avatarId}
                    frameId={f.frameId}
                    size={44}
                    presence={f.presenceStatus}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text">
                      {f.displayName}
                    </p>
                    <p className="flex items-center gap-2 truncate text-xs text-muted">
                      {f.username ? `@${f.username}` : f.publicUid}
                      {f.presenceStatus === "studying" ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          · Studying now
                        </span>
                      ) : (
                        <span> · Lv {f.level}</span>
                      )}
                      {f.currentStreak > 0 ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Flame className="h-3 w-3 text-orange-500" />
                          {f.currentStreak}d
                        </span>
                      ) : null}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => confirmUnfriend(f)}
                  className="rounded-lg p-2 text-muted transition hover:bg-white/40 hover:text-alert dark:hover:bg-white/10"
                  aria-label={`Remove ${f.displayName}`}
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </Card>
            ))}
          </div>
        )
      ) : (
        <RequestsTab
          inbox={inbox}
          outbox={outbox}
          onRespond={respond}
          onCancel={cancel}
          onFind={() => setSearchOpen(true)}
        />
      )}

      <SearchModal
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false);
          void refresh();
        }}
      />

      <UnfriendConfirmModal
        open={unfriendTarget != null}
        target={unfriendTarget}
        busy={unfriendBusy}
        error={error}
        onConfirm={() => void executeUnfriend()}
        onCancel={cancelUnfriend}
      />
    </div>
  );
}

function Header({
  onSearch,
  studyingCount = 0,
}: {
  onSearch: () => void;
  studyingCount?: number;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Social</h1>
        <p className="mt-1 text-sm text-muted">
          {studyingCount > 0
            ? `${studyingCount} ${studyingCount === 1 ? "friend is" : "friends are"} studying right now.`
            : "Connect with study partners and keep each other accountable."}
        </p>
      </div>
      <Button variant="secondary" onClick={onSearch} className="shrink-0">
        <Search className="h-4 w-4" /> Find people
      </Button>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-white text-text shadow-sm dark:bg-white/15"
          : "text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function RequestsTab({
  inbox,
  outbox,
  onRespond,
  onCancel,
  onFind,
}: {
  inbox: FriendRequest[];
  outbox: FriendRequest[];
  onRespond: (id: string, accept: boolean) => void;
  onCancel: (id: string) => void;
  onFind: () => void;
}) {
  if (inbox.length === 0 && outbox.length === 0) {
    return (
      <EmptyState
        icon={UserPlus}
        title="No pending requests"
        body="When someone adds you, their request shows up here."
        action={
          <Button variant="secondary" onClick={onFind}>
            <Search className="h-4 w-4" /> Find people
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-4">
      {inbox.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Incoming
          </h2>
          {inbox.map((r) => (
            <Card key={r.requestId} className="flex items-center gap-3 p-3">
              <Link href={profileHref(r)} className="flex min-w-0 flex-1 items-center gap-3">
                <UserAvatar
                  userId={r.userId}
                  displayName={r.displayName}
                  avatarId={r.avatarId}
                  frameId={r.frameId}
                  size={44}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">
                    {r.displayName}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {r.username ? `@${r.username}` : r.publicUid}
                  </p>
                </div>
              </Link>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onRespond(r.requestId, true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                >
                  <Check className="h-3.5 w-3.5" /> Accept
                </button>
                <button
                  type="button"
                  onClick={() => onRespond(r.requestId, false)}
                  className="rounded-lg border border-white/45 bg-white/30 p-1.5 text-muted transition hover:text-alert dark:border-white/10 dark:bg-white/[0.05]"
                  aria-label="Decline"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {outbox.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Sent
          </h2>
          {outbox.map((r) => (
            <Card key={r.requestId} className="flex items-center gap-3 p-3">
              <Link href={profileHref(r)} className="flex min-w-0 flex-1 items-center gap-3">
                <UserAvatar
                  userId={r.userId}
                  displayName={r.displayName}
                  avatarId={r.avatarId}
                  frameId={r.frameId}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">
                    {r.displayName}
                  </p>
                  <p className="truncate text-xs text-muted">Request pending</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => onCancel(r.requestId)}
                className="rounded-lg border border-white/45 bg-white/30 px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-alert dark:border-white/10 dark:bg-white/[0.05]"
              >
                Cancel
              </button>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/40 text-muted dark:bg-white/10">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-text">{title}</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{body}</p>
      </div>
      {action}
    </Card>
  );
}
