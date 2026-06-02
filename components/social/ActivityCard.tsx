"use client";

import { UserAvatar } from "./UserAvatar";
import { timeAgo } from "@/lib/social/format";
import { profileHref, type ActivityEvent } from "@/lib/social/types";
import { ACHIEVEMENTS, type AchievementId } from "@/lib/gamification/achievements";
import {
  Award,
  BookOpen,
  Flame,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";

const VERB_ICON = {
  session_completed: BookOpen,
  streak_milestone: Flame,
  achievement_unlocked: Award,
  level_up: TrendingUp,
  friend_request_accepted: UserPlus,
  buddy_paired: Users,
  started_studying: BookOpen,
} as const;

function describe(event: ActivityEvent): string {
  const m = event.metadata ?? {};
  switch (event.verb) {
    case "started_studying":
      return "started studying";
    case "session_completed": {
      const min = Number(m.focusMinutes ?? 0);
      const acc = Number(m.averageFocus ?? 0);
      const parts = [];
      if (min) parts.push(`${min}m focus`);
      if (acc) parts.push(`${acc}% focused`);
      return parts.length
        ? `completed a session · ${parts.join(" · ")}`
        : "completed a study session";
    }
    case "streak_milestone":
      return `hit a ${Number(m.streak ?? 0)}-day streak`;
    case "achievement_unlocked": {
      const id = event.objectId as AchievementId | null;
      const title = id && id in ACHIEVEMENTS ? ACHIEVEMENTS[id].title : "an achievement";
      return `unlocked ${title}`;
    }
    case "level_up":
      return `reached level ${Number(m.level ?? 0)}`;
    case "friend_request_accepted":
      return "made a new friend";
    case "buddy_paired":
      return "paired with a study buddy";
    default:
      return "did something";
  }
}

export function ActivityCard({ event }: { event: ActivityEvent }) {
  const Icon = VERB_ICON[event.verb] ?? Trophy;
  const isStudying = event.verb === "started_studying";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/40 bg-white/30 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
      <Link href={profileHref(event)} className="shrink-0">
        <UserAvatar
          userId={event.actorId}
          displayName={event.displayName}
          avatarId={event.avatarId}
          frameId={event.frameId}
          size={40}
          presence={isStudying ? "studying" : undefined}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text">
          <Link
            href={profileHref(event)}
            className="font-semibold hover:underline"
          >
            {event.displayName}
          </Link>{" "}
          <span className="text-muted">{describe(event)}</span>
        </p>
        <p className="text-[11px] text-muted">{timeAgo(event.createdAt)}</p>
      </div>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/40 text-muted dark:bg-white/10">
        <Icon className="h-4 w-4" />
      </span>
    </div>
  );
}
