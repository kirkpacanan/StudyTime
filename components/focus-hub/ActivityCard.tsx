"use client";

import { cn } from "@/lib/cn";
import {
  ACTIVITY_TYPE_LABELS,
  type ActivityStatus,
  type FocusHubActivity,
} from "@/lib/focus-hub/types";
import {
  BookOpen,
  Brain,
  CalendarClock,
  CheckCircle,
  Circle,
  ClipboardList,
  Clock,
  PlayCircle,
  Users,
} from "lucide-react";
import Link from "next/link";

const TYPE_ICONS = {
  study_session: BookOpen,
  assignment: ClipboardList,
  quiz: Brain,
  training: Users,
  meeting: Users,
};

const STATUS_CONFIG: Record<
  ActivityStatus,
  { label: string; icon: typeof Circle; className: string }
> = {
  draft: {
    label: "Draft",
    icon: Circle,
    className: "text-muted border-muted/30 bg-muted/10",
  },
  active: {
    label: "Live",
    icon: PlayCircle,
    className: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "text-sky-400 border-sky-500/30 bg-sky-500/10",
  },
};

type ActivityCardProps = {
  activity: FocusHubActivity;
  roomId: string;
  isHost?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
};

function fmt(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityCard({
  activity,
  roomId,
  isHost,
  onStart,
  onEnd,
}: ActivityCardProps) {
  const Icon = TYPE_ICONS[activity.activity_type] ?? BookOpen;
  const status = STATUS_CONFIG[activity.status];
  const StatusIcon = status.icon;

  return (
    <div className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5">
      {/* Top row */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-4.5 w-4.5 text-primary" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">{activity.title}</p>
            <p className="text-xs text-muted">
              {ACTIVITY_TYPE_LABELS[activity.activity_type]}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            status.className,
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </div>

      {/* Description */}
      {activity.description && (
        <p className="mb-3 line-clamp-2 text-xs text-muted">
          {activity.description}
        </p>
      )}

      {/* Meta row */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted">
        {activity.duration_minutes && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {activity.duration_minutes} min
          </span>
        )}
        {activity.due_at && (
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            Due {fmt(activity.due_at)}
          </span>
        )}
        {activity.focus_required && (
          <span className="flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">
            <Brain className="h-3 w-3" />
            Focus tracked
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {activity.status === "active" && !isHost && (
          <Link
            href={`/focus-hub/${roomId}/activities/${activity.id}/focus`}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-sky-900/30 transition hover:bg-sky-500"
          >
            <PlayCircle className="h-4 w-4" />
            Join Activity
          </Link>
        )}
        {activity.status === "active" && isHost && (
          <button
            type="button"
            onClick={onEnd}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
          >
            End Activity
          </button>
        )}
        {activity.status === "draft" && isHost && (
          <button
            type="button"
            onClick={onStart}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-900/30 transition hover:bg-emerald-500"
          >
            <PlayCircle className="h-4 w-4" />
            Start Activity
          </button>
        )}
        <Link
          href={`/focus-hub/${roomId}/activities/${activity.id}`}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--cc-border)] bg-white/5 px-3 py-2 text-xs font-medium text-muted transition hover:text-text"
        >
          Details
        </Link>
      </div>
    </div>
  );
}
