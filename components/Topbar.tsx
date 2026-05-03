"use client";

import { useAuth } from "@/hooks/useAuth";
import { useSessionLive } from "@/contexts/session-live-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

function stateLabel(
  s: "focused" | "drifting" | "distracted" | "away" | null,
) {
  if (!s) return null;
  if (s === "focused") return "Focused";
  if (s === "drifting") return "Drifting";
  if (s === "distracted") return "Distracted";
  return "Away";
}

export function Topbar() {
  const { user, signOut } = useAuth();
  const { live } = useSessionLive();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-primary/10 bg-surface/90 px-4 backdrop-blur md:px-8">
      <div className="min-w-0 pl-12 md:pl-0">
        <p className="truncate text-sm font-medium text-text">
          {user?.name ?? "Student"}
        </p>
        <p className="truncate text-xs text-muted">{user?.email}</p>
      </div>
      <div className="flex items-center gap-2">
        {live.running ? (
          <Badge
            tone={
              live.focusState === "focused"
                ? "blue"
                : live.focusState === "drifting"
                  ? "yellow"
                  : live.focusState === "distracted" || live.focusState === "away"
                    ? "red"
                    : "muted"
            }
          >
            {live.phase === "break" ? "Break" : stateLabel(live.focusState)}
            {live.score !== null && live.phase === "focus" ? (
              <span className="ml-1 opacity-80">· {live.score}%</span>
            ) : null}
          </Badge>
        ) : null}
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
    </header>
  );
}
