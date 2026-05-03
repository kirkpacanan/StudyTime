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
        "h-2 w-full overflow-hidden rounded-full bg-primary-soft",
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
