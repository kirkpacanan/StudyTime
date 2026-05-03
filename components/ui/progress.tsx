import { cn } from "@/lib/cn";

export function Progress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full border border-white/45 bg-white/[0.35] backdrop-blur-md backdrop-saturate-150 dark:border-white/[0.12] dark:bg-slate-800/[0.45]",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-300"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
