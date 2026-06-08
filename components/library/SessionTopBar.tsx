"use client";

import { BookOpen, Users, Wifi, WifiOff, X } from "lucide-react";
import { usePresence } from "@/contexts/presence-context";
import { isSupabaseEnabled } from "@/lib/supabase/config";
type SessionTopBarProps = {
  studyingCount: number;
  roomName?: string;
  onExit: () => void;
};

export function SessionTopBar({
  studyingCount,
  roomName = "Main Library",
  onExit,
}: SessionTopBarProps) {
  const { friends } = usePresence();
  const supabaseOn = isSupabaseEnabled();

  const friendsStudying = Object.values(friends).filter((s) => s === "studying").length;
  const friendsOnline = Object.values(friends).filter((s) => s !== "offline").length;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-[250] flex items-start justify-between gap-3 px-4 pt-4">
      <div className="library-glass-panel pointer-events-auto min-w-0 max-w-[min(100%,20rem)] px-4 py-3">
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

      <button
        type="button"
        onClick={onExit}
        className="library-glass-panel pointer-events-auto flex h-10 w-10 items-center justify-center transition hover:bg-white/[0.06]"
        aria-label="Back to dashboard"
      >
        <X className="h-4 w-4 text-slate-300" />
      </button>
    </header>
  );
}
