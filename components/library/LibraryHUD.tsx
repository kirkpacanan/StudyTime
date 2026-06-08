"use client";

import { Users, BookOpen, Wifi, WifiOff } from "lucide-react";
import { usePresence } from "@/contexts/presence-context";
import { isSupabaseEnabled } from "@/lib/supabase/config";

type LibraryHUDProps = {
  studyingCount: number;
  roomName?: string;
};

export function LibraryHUD({ studyingCount, roomName = "Main Library" }: LibraryHUDProps) {
  const { friends } = usePresence();
  const supabaseOn = isSupabaseEnabled();

  const friendsStudying = Object.values(friends).filter((s) => s === "studying").length;
  const friendsOnline = Object.values(friends).filter((s) => s !== "offline").length;

  return (
    <div className="fixed left-4 top-4 z-[60] flex flex-col gap-2">
      <div className="library-glass-panel flex items-center gap-2 px-3 py-2">
        <BookOpen className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-semibold text-white">{roomName}</span>
        {supabaseOn ? (
          <Wifi className="ml-1 h-3 w-3 text-emerald-400" />
        ) : (
          <WifiOff className="ml-1 h-3 w-3 text-slate-500" />
        )}
      </div>

      <div className="library-glass-panel flex items-center gap-2 px-3 py-2">
        <Users className="h-4 w-4 text-sky-400" />
        <div>
          <p className="text-xs font-semibold text-white tabular-nums">
            {studyingCount} studying now
          </p>
          {friendsOnline > 0 && (
            <p className="text-[10px] text-slate-400">
              {friendsStudying} friend{friendsStudying !== 1 ? "s" : ""} online
            </p>
          )}
        </div>
      </div>

      {friendsStudying > 0 && (
        <div className="library-glass-panel border-emerald-500/20 px-3 py-2">
          <p className="text-[11px] font-medium text-emerald-300">
            {friendsStudying} friend{friendsStudying !== 1 ? "s" : ""} studying
          </p>
        </div>
      )}
    </div>
  );
}
