"use client";

import { useAuth } from "@/hooks/useAuth";
import { useSessionLive } from "@/contexts/session-live-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut } from "lucide-react";
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
  const { live } = useSessionLive();

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
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Log out
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="sm:hidden"
          onClick={() => signOut()}
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </motion.header>
  );
}
