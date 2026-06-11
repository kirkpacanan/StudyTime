"use client";

import {
  BarChart3,
  BookOpen,
  Check,
  Copy,
  Hash,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Monitor,
  Play,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePresence } from "@/contexts/presence-context";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { cn } from "@/lib/cn";

type SessionTopBarProps = {
  studyingCount: number;
  roomName?: string;
  roomId?: string;
  joinCode?: string;
  isHost?: boolean;
  isPrivateRoom?: boolean;
  isActivityRoom?: boolean;
  isImmersive?: boolean;
  onToggleImmersive?: () => void;
  onChangeLibrary?: () => void;
  onInviteParticipants?: () => void;
  onManageActivity?: () => void;
  /** Hide fullscreen control (e.g. while host activity panel is open). */
  hideImmersiveToggle?: boolean;
};

export function SessionTopBar({
  studyingCount,
  roomName = "Main Library",
  roomId,
  joinCode,
  isHost = false,
  isPrivateRoom = false,
  isActivityRoom = false,
  isImmersive = false,
  onToggleImmersive,
  onChangeLibrary,
  onInviteParticipants,
  onManageActivity,
  hideImmersiveToggle = false,
}: SessionTopBarProps) {
  const { friends } = usePresence();
  const supabaseOn = isSupabaseEnabled();
  const [copied, setCopied] = useState(false);

  const friendsStudying = Object.values(friends).filter((s) => s === "studying").length;
  const friendsOnline = Object.values(friends).filter((s) => s !== "offline").length;

  async function copyCode() {
    if (!joinCode) return;
    await navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-[250] flex items-start justify-between gap-2 px-3 pt-3 sm:gap-3 sm:px-4 sm:pt-4">
      <div className="library-glass-panel pointer-events-auto min-w-0 max-w-[min(100%,22rem)] px-3 py-2.5 sm:max-w-[min(100%,24rem)] sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-cyan-300/90" />
          <span className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-slate-200">
            {roomName}
          </span>
          {supabaseOn ? (
            <Wifi className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-400" />
          ) : (
            <WifiOff className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-500" />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3 shrink-0 text-cyan-400/70" />
            <span className="font-medium tabular-nums text-slate-300">
              {studyingCount} studying now
            </span>
          </span>
          {friendsOnline > 0 && (
            <span>
              · {friendsStudying} friend{friendsStudying !== 1 ? "s" : ""} online
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {!isPrivateRoom && onChangeLibrary ? (
            <button
              type="button"
              onClick={onChangeLibrary}
              className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <LayoutGrid className="h-3 w-3" />
              Change library
            </button>
          ) : isPrivateRoom ? (
            <Link
              href="/session"
              className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <LayoutGrid className="h-3 w-3" />
              All libraries
            </Link>
          ) : null}
          {joinCode ? (
            <button
              type="button"
              onClick={() => void copyCode()}
              className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              <Hash className="h-3 w-3 opacity-60" />
              {joinCode}
            </button>
          ) : null}
          {isActivityRoom && isHost && onManageActivity ? (
            <button
              type="button"
              onClick={onManageActivity}
              className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-200 transition hover:bg-emerald-500/20"
            >
              <Play className="h-3 w-3" />
              Activity
            </button>
          ) : null}
          {isActivityRoom && isHost && onInviteParticipants ? (
            <button
              type="button"
              onClick={onInviteParticipants}
              className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-200 transition hover:bg-violet-500/20"
            >
              <UserPlus className="h-3 w-3" />
              Invite
            </button>
          ) : null}
          {isActivityRoom && isHost && roomId ? (
            <>
              <Link
                href={`/session/room/${roomId}/monitor`}
                className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-200 transition hover:bg-cyan-500/20"
              >
                <Monitor className="h-3 w-3" />
                Monitor
              </Link>
              <Link
                href={`/session/room/${roomId}/analytics`}
                className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <BarChart3 className="h-3 w-3" />
                Analytics
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {onToggleImmersive && !hideImmersiveToggle ? (
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleImmersive}
            className={cn(
              "library-glass-panel flex h-10 items-center justify-center gap-2 px-3 transition hover:bg-white/[0.06] sm:px-3.5",
              isImmersive && "ring-1 ring-amber-400/30",
            )}
            aria-label={isImmersive ? "Exit fullscreen" : "Enter fullscreen"}
            title={isImmersive ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
          >
            {isImmersive ? (
              <Minimize2 className="h-4 w-4 shrink-0 text-amber-200" />
            ) : (
              <Maximize2 className="h-4 w-4 shrink-0 text-slate-300" />
            )}
            <span className="hidden text-xs font-medium text-slate-200 sm:inline">
              {isImmersive ? "Exit" : "Fullscreen"}
            </span>
          </button>
        </div>
      ) : null}
    </header>
  );
}
