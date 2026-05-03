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
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {title}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-text">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-muted">{hint}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft",
            ring,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </Card>
  );
}
