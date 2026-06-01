"use client";

import { Card } from "@/components/ui/card";
import { useProgression } from "@/contexts/progression-context";
import { nextStreakMilestone } from "@/lib/gamification/streaks";
import { Flame, Shield, Trophy } from "lucide-react";

export function StreakCard() {
  const { snapshot } = useProgression();
  if (!snapshot) {
    return (
      <Card className="h-full animate-pulse p-5">
        <div className="h-20" />
      </Card>
    );
  }
  const s = snapshot.streak;
  const next = nextStreakMilestone(s);
  const pct = next ? Math.min(100, Math.round((s.current / next.days) * 100)) : 100;

  return (
    <Card className="h-full p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <Flame className="h-5 w-5 text-orange-500" />
        Study streak
      </div>
      <div className="mt-3 flex items-end gap-4">
        <div>
          <p className="text-3xl font-bold tabular-nums text-text">{s.current}</p>
          <p className="text-[11px] text-muted">current days</p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-sm font-semibold tabular-nums text-text">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            {s.longest}
          </p>
          <p className="text-[11px] text-muted">longest</p>
        </div>
        <div className="ml-auto text-right">
          <p className="flex items-center justify-end gap-1 text-sm font-semibold tabular-nums text-text">
            <Shield className="h-3.5 w-3.5 text-sky-500" />
            {s.freezeTokens}
          </p>
          <p className="text-[11px] text-muted">freezes</p>
        </div>
      </div>
      {next ? (
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[11px] text-muted">
            <span>Next: {next.label}</span>
            <span className="tabular-nums">
              {s.current}/{next.days}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-white/40 bg-white/40 dark:border-white/10 dark:bg-slate-800/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-rose-500 transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-muted">All streak milestones earned. 🔥</p>
      )}
    </Card>
  );
}
