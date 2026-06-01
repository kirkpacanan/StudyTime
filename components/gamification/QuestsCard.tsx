"use client";

import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { useProgression } from "@/contexts/progression-context";
import type { Quest } from "@/lib/gamification/quests";
import { CheckCircle2, ScrollText } from "lucide-react";

function QuestRow({ q }: { q: Quest }) {
  const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5 truncate",
            q.completed ? "text-emerald-600 dark:text-emerald-400" : "text-text",
          )}
        >
          {q.completed ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : null}
          <span className="truncate">{q.title}</span>
        </span>
        <span className="shrink-0 tabular-nums text-muted">+{q.rewardXp} XP</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-white/40 bg-white/40 dark:border-white/10 dark:bg-slate-800/50">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              q.completed
                ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                : "bg-gradient-to-r from-sky-400 to-blue-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-muted">
          {Math.min(q.progress, q.target)}/{q.target}
        </span>
      </div>
    </div>
  );
}

export function QuestsCard() {
  const { snapshot } = useProgression();
  if (!snapshot) {
    return (
      <Card className="h-full animate-pulse p-5">
        <div className="h-20" />
      </Card>
    );
  }
  return (
    <Card className="h-full p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <ScrollText className="h-5 w-5 text-primary" />
        Daily quests
      </div>
      <div className="mt-3 space-y-2.5">
        {snapshot.dailyQuests.map((q) => (
          <QuestRow key={q.id} q={q} />
        ))}
      </div>
      {snapshot.weeklyQuest ? (
        <div className="mt-3 border-t border-white/30 pt-3 dark:border-white/10">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Weekly challenge
          </p>
          <QuestRow q={snapshot.weeklyQuest} />
        </div>
      ) : null}
    </Card>
  );
}
