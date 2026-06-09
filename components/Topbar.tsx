"use client";

import { useAuth } from "@/hooks/useAuth";
import { useSessionLive } from "@/contexts/session-live-context";
import { usePresence } from "@/contexts/presence-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/social/NotificationBell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Users } from "lucide-react";
import Link from "next/link";
import type { FocusSampleState } from "@/lib/types";

function stateLabel(s: FocusSampleState | null) {
  if (!s) return null;
  if (s === "focused") return "Focused";
  if (s === "drifting") return "Drifting";
  if (s === "distracted") return "Distracted";
  if (s === "sleeping") return "Sleeping";
  return "Away";
}

export function Topbar() {
  const { user, signOut } = useAuth();
  const { live, requestNavAway } = useSessionLive();
  const { studyingCount } = usePresence();

  return (
    <motion.header
      className="glass-topbar sticky top-0 z-10 flex h-16 items-center justify-between gap-3 px-4 md:px-8"
      initial={false}
    >
      <div className="min-w-0 pl-12 md:pl-0">
        <p className="truncate text-sm font-medium text-text">
          {user?.name ?? "Student"}
        </p>
        <p className="truncate text-xs text-muted">{user?.email}</p>
      </div>
      <div className="flex items-center gap-2">
        {studyingCount > 0 ? (
          <Link
            href="/friends"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
            title="Friends studying now"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{studyingCount} studying</span>
            <span className="sm:hidden">{studyingCount}</span>
          </Link>
        ) : null}
        <NotificationBell />
        <ThemeToggle variant="inline" />
        <AnimatePresence mode="wait">
          {live.running ? (
            <motion.div
              key="live-badge"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <Badge
                tone={
                  live.focusState === "focused"
                    ? "blue"
                    : live.focusState === "drifting"
                      ? "yellow"
                      : live.focusState === "sleeping"
                        ? "muted"
                        : live.focusState === "distracted" ||
                            live.focusState === "away"
                          ? "red"
                          : "muted"
                }
              >
                {live.phase === "break" ? "Break" : stateLabel(live.focusState)}
                {live.score !== null && live.phase === "focus" ? (
                  <span className="ml-1 opacity-80">· {live.score}%</span>
                ) : null}
              </Badge>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <Button
          type="button"
          variant="secondary"
          className="hidden sm:inline-flex"
          onClick={() => {
            if (live.running) {
              requestNavAway("__logout__");
            } else {
              void signOut();
            }
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Log out
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="sm:hidden"
          onClick={() => {
            if (live.running) {
              requestNavAway("__logout__");
            } else {
              void signOut();
            }
          }}
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </motion.header>
  );
}
