"use client";

import { cn } from "@/lib/cn";
import type { LibraryRoomWithRole } from "@/lib/library-rooms";
import { motion } from "framer-motion";
import { Activity, BookOpen, Check, Copy, LogOut, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type LibraryRoomCardProps = {
  room: LibraryRoomWithRole;
  onSelect?: (roomId: string) => void;
  onDelete?: (room: LibraryRoomWithRole) => void;
  onLeave?: (room: LibraryRoomWithRole) => void;
  variant?: "default" | "lobby";
};

const CATEGORY_COLORS: Record<string, string> = {
  education: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  business: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  training: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  meeting: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

function RoomCardContent({
  room,
  copied,
  onCopyCode,
  onDelete,
  onLeave,
  variant,
}: {
  room: LibraryRoomWithRole;
  copied: boolean;
  onCopyCode: (e: React.MouseEvent) => void;
  onDelete?: (room: LibraryRoomWithRole) => void;
  onLeave?: (room: LibraryRoomWithRole) => void;
  variant: "default" | "lobby";
}) {
  const categoryStyle =
    CATEGORY_COLORS[room.category?.toLowerCase() ?? ""] ??
    "bg-primary/15 text-primary border-primary/20";

  const isLobby = variant === "lobby";

  const surfaceCls = isLobby
    ? "pomodoro-game-room-card group"
    : "group relative overflow-hidden rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4 transition-shadow hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/30 sm:p-5";

  if (isLobby) {
    return (
      <div className="game-lite-room-card">
        <div className="flex flex-1 gap-3">
          <div className="game-lite-icon !h-10 !w-10 !rounded-lg">
            {room.image_url ? (
              <img
                src={room.image_url}
                alt=""
                className="h-full w-full rounded-lg object-cover"
              />
            ) : (
              <BookOpen className="h-4 w-4 text-sky-200" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-1 text-sm font-bold text-white">
                {room.name}
              </p>
              {room.role === "host" && onDelete ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(room);
                  }}
                  className="shrink-0 rounded-md p-1 text-red-300/70 transition hover:bg-red-500/15 hover:text-red-300"
                  aria-label={`Delete ${room.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {room.role === "participant" && onLeave ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onLeave(room);
                  }}
                  className="shrink-0 rounded-md p-1 text-sky-300/60 transition hover:bg-white/10 hover:text-sky-100"
                  aria-label={`Leave ${room.name}`}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {room.role === "host" && (
                <span className="game-lite-badge game-lite-badge-gold">Host</span>
              )}
              {room.category && (
                <span className="game-lite-badge game-lite-badge-sky capitalize">
                  {room.category}
                </span>
              )}
              <span className="game-lite-badge border-violet-500/35 bg-violet-500/12 text-violet-200">
                <Activity className="h-2.5 w-2.5" />
                Activity
              </span>
            </div>
            {room.description ? (
              <p className="mt-2 line-clamp-1 text-[11px] leading-relaxed text-sky-200/50">
                {room.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-sky-300/60">
            <Users className="h-3.5 w-3.5" />
            <span>
              {room.memberCount} / {room.participant_limit}
            </span>
          </div>
          <button
            type="button"
            onClick={onCopyCode}
            className="game-lite-code"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {room.join_code}
          </button>
        </div>

        <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wide text-amber-300/85">
          Enter library →
        </p>
      </div>
    );
  }

  return (
    <div className={surfaceCls}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          {room.image_url ? (
            <img
              src={room.image_url}
              alt=""
              className="h-9 w-9 rounded-xl object-cover"
            />
          ) : (
            <BookOpen className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {room.role === "host" && onDelete ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(room);
              }}
              className="rounded-lg p-1 text-muted transition hover:bg-alert/10 hover:text-alert"
              aria-label={`Delete ${room.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {room.role === "participant" && onLeave ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onLeave(room);
              }}
              className="rounded-lg p-1 text-muted transition hover:bg-white/10 hover:text-text"
              aria-label={`Leave ${room.name}`}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/25 bg-violet-400/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">
            <Activity className="h-2.5 w-2.5" />
            Activity
          </span>
          {room.role === "host" && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
              Host
            </span>
          )}
          {room.category && (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                categoryStyle,
              )}
            >
              {room.category}
            </span>
          )}
        </div>
      </div>

      <p className="line-clamp-1 text-sm font-bold text-text">{room.name}</p>
      {room.description && (
        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{room.description}</p>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted">
          <Users className="h-3.5 w-3.5" />
          <span>
            {room.memberCount} / {room.participant_limit}
          </span>
        </div>

        <button
          type="button"
          onClick={onCopyCode}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--cc-border)] bg-white/5 px-2 py-1 text-[10px] font-mono font-semibold text-muted transition hover:text-text"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {room.join_code}
        </button>
      </div>

      <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-primary/80">
        Enter library →
      </p>
    </div>
  );
}

export function LibraryRoomCard({
  room,
  onSelect,
  onDelete,
  onLeave,
  variant = "default",
}: LibraryRoomCardProps) {
  const [copied, setCopied] = useState(false);

  function handleCopyCode(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    void navigator.clipboard.writeText(room.join_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const content = (
    <RoomCardContent
      room={room}
      copied={copied}
      onCopyCode={handleCopyCode}
      onDelete={onDelete}
      onLeave={onLeave}
      variant={variant}
    />
  );

  return (
    <motion.div
      whileHover={variant === "lobby" ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      {onSelect ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect(room.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(room.id);
            }
          }}
          className="block w-full cursor-pointer text-left"
        >
          {content}
        </div>
      ) : (
        <Link href={`/session/room/${room.id}`} className="block">
          {content}
        </Link>
      )}
    </motion.div>
  );
}
