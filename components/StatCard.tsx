import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  accent = "blue",
}: {
  title: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: "blue" | "green" | "yellow" | "muted";
}) {
  const ring =
    accent === "green"
      ? "text-success"
      : accent === "yellow"
        ? "text-accent"
        : accent === "muted"
          ? "text-muted"
          : "text-primary";
  return (
    <Card className="flex h-full min-h-[9.25rem] w-full min-w-0 flex-col p-4 md:p-5">
      <div className="flex min-h-0 min-w-0 flex-1 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {title}
          </p>
          <p className="mt-2 truncate text-2xl font-semibold tabular-nums tracking-tight text-text">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted">
              {hint}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "glass-icon-tile flex h-10 w-10 shrink-0 items-center justify-center",
            ring,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </Card>
  );
}
