"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ParticipantLiveState } from "@/lib/focus-hub/types";
import { ParticipantFocusCard } from "./ParticipantFocusCard";
import { Users } from "lucide-react";

type LiveFocusGridProps = {
  participants: ParticipantLiveState[];
  avgScore: number;
  flaggedCount: number;
};

export function LiveFocusGrid({ participants, avgScore, flaggedCount }: LiveFocusGridProps) {
  if (participants.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-muted">
        <Users className="h-10 w-10 opacity-40" />
        <p className="text-sm">Waiting for participants to join…</p>
        <p className="text-xs opacity-60">
          Share the room code so participants can start tracking their focus.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] px-4 py-3">
          <p className="text-xs text-muted">Participants</p>
          <p className="text-xl font-bold text-text">{participants.length}</p>
        </div>
        <div className="flex-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-xs text-muted">Avg Focus</p>
          <p className="text-xl font-bold text-emerald-400">{avgScore}%</p>
        </div>
        {flaggedCount > 0 && (
          <div className="flex-1 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3">
            <p className="text-xs text-muted">Flagged</p>
            <p className="text-xl font-bold text-red-400">{flaggedCount}</p>
          </div>
        )}
      </div>

      {/* Grid */}
      <motion.div
        layout
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <AnimatePresence>
          {participants.map((p) => (
            <motion.div
              key={p.userId}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
            >
              <ParticipantFocusCard participant={p} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
