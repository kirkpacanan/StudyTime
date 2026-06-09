"use client";

import {
  getNotifications,
  markNotificationsRead,
} from "@/lib/social/feed-service";
import { profileHref } from "@/lib/social/types";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { timeAgo } from "@/lib/social/format";
import type { AppNotification } from "@/lib/social/types";
import { AnimatePresence, motion } from "framer-motion";
import { Award, Bell, Check, Heart, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 60_000;

function actorName(payload: Record<string, unknown>): string {
  const name = payload.displayName;
  if (typeof name === "string" && name.trim()) return name;
  const username = payload.username;
  if (typeof username === "string" && username.trim()) return `@${username}`;
  const uid = payload.publicUid;
  if (typeof uid === "string" && uid.trim()) return uid;
  return "Someone";
}

function label(n: AppNotification): {
  actor: string;
  text: string;
  icon: typeof Bell;
  href: string;
} {
  const p = n.payload ?? {};
  const actor = actorName(p);
  switch (n.type) {
    case "friend_request":
      return {
        actor,
        text: "sent you a friend request",
        icon: UserPlus,
        href: "/friends",
      };
    case "friend_request_accepted":
      return {
        actor,
        text: "accepted your friend request",
        icon: Users,
        href: profileHref({
          username: p.username as string | null,
          publicUid: p.publicUid as string | null,
        }),
      };
    case "buddy_request":
      return {
        actor,
        text: "sent you a study buddy request",
        icon: Heart,
        href: "/leaderboard",
      };
    case "buddy_request_accepted":
      return {
        actor,
        text: "accepted your study buddy request",
        icon: Heart,
        href: profileHref({
          username: p.username as string | null,
          publicUid: p.publicUid as string | null,
        }),
      };
    case "buddy_request_declined":
      return {
        actor,
        text: "declined your study buddy request",
        icon: X,
        href: "/leaderboard",
      };
    case "buddy_request_canceled":
      return {
        actor,
        text: "canceled their study buddy request",
        icon: X,
        href: "/leaderboard",
      };
    case "buddy_removed":
      return {
        actor,
        text: "removed you as a study buddy",
        icon: Users,
        href: "/leaderboard",
      };
    case "buddy_paired":
      return {
        actor,
        text: "paired with you as a study buddy",
        icon: Users,
        href: "/leaderboard",
      };
    case "buddy_studied":
      return {
        actor,
        text: "studied today — your +20% XP bonus is active",
        icon: Check,
        href: "/feed",
      };
    case "achievement_unlocked":
      return {
        actor,
        text: "unlocked an achievement",
        icon: Award,
        href: "/feed",
      };
    default:
      return { actor: "StudyTime", text: "New activity", icon: Bell, href: "/feed" };
  }
}

export function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseEnabled()) return;
    const rows = await getNotifications(20);
    setItems(rows);
  }, []);

  useEffect(() => {
    if (!isSupabaseEnabled()) return;
    void refresh();
    const poll = window.setInterval(() => void refresh(), POLL_MS);

    let channel: ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | null =
      null;
    try {
      const supabase = getSupabaseBrowser();
      channel = supabase
        .channel("notifications")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          () => void refresh(),
        )
        .subscribe();
    } catch {
      /* realtime optional */
    }

    return () => {
      window.clearInterval(poll);
      if (channel) {
        try {
          void getSupabaseBrowser().removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [refresh]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!isSupabaseEnabled()) return null;

  const unread = items.filter((i) => !i.readAt).length;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await markNotificationsRead();
      setItems((prev) =>
        prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })),
      );
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => void toggle()}
        className="glass-floating-btn relative flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:text-text"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="glass-card absolute right-0 top-11 z-50 w-80 overflow-hidden p-0"
          >
            <div className="border-b border-[var(--cc-border)] px-3 py-2 text-xs font-semibold text-text">
              Notifications
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted">
                  No notifications yet.
                </p>
              ) : (
                <ul>
                  {items.map((n) => {
                    const { actor, text, icon: Icon, href } = label(n);
                    return (
                      <li key={n.id}>
                        <Link
                          href={href}
                          onClick={() => setOpen(false)}
                          className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-white/30 dark:hover:bg-white/[0.06]"
                        >
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/40 text-muted dark:bg-white/10">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs text-text">
                              <span className="font-semibold">{actor}</span>{" "}
                              <span className="text-muted">{text}</span>
                            </span>
                            <span className="block text-[10px] text-muted">
                              {timeAgo(n.createdAt)}
                            </span>
                          </span>
                          {!n.readAt ? (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
