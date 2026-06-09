"use client";

import { BookOpen, Maximize2, Minimize2, Users, Wifi, WifiOff } from "lucide-react";
import { usePresence } from "@/contexts/presence-context";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { cn } from "@/lib/cn";

type SessionTopBarProps = {
  studyingCount: number;
  roomName?: string;
  isImmersive?: boolean;
  onToggleImmersive?: () => void;
};

export function SessionTopBar({
  studyingCount,
  roomName = "Main Library",
  isImmersive = false,
  onToggleImmersive,
}: SessionTopBarProps) {
  const { friends } = usePresence();
  const supabaseOn = isSupabaseEnabled();

  const friendsStudying = Object.values(friends).filter((s) => s === "studying").length;
  const friendsOnline = Object.values(friends).filter((s) => s !== "offline").length;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-[250] flex items-start justify-between gap-2 px-3 pt-3 sm:gap-3 sm:px-4 sm:pt-4">
      <div className="library-glass-panel pointer-events-auto min-w-0 max-w-[min(100%,18rem)] px-3 py-2.5 sm:max-w-[min(100%,20rem)] sm:px-4 sm:py-3">
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
        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
          <Users className="h-3 w-3 shrink-0 text-cyan-400/70" />
          <span className="font-medium tabular-nums text-slate-300">
            {studyingCount} studying now
          </span>
          {friendsOnline > 0 && (
            <span className="text-slate-400">
              · {friendsStudying} friend{friendsStudying !== 1 ? "s" : ""} online
            </span>
          )}
        </div>
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center gap-2">
        {onToggleImmersive ? (
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
        ) : null}
      </div>
    </header>
  );
}
