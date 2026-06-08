"use client";

import { cn } from "@/lib/cn";

/** Minimal drag affordance — three lines. */
export function LibraryDragGrip({ className }: { className?: string }) {
  return (
    <span className={cn("library-drag-grip", className)} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

/** Shared icon button for panel headers (minimize, close, back). */
export function LibraryIconButton({
  onClick,
  label,
  children,
  variant = "ghost",
  className,
}: {
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
  variant?: "ghost" | "danger";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-white/[0.06] transition",
        variant === "danger"
          ? "text-slate-400 hover:bg-red-500/12 hover:text-red-200 hover:ring-red-500/20"
          : "text-slate-400 hover:bg-white/[0.08] hover:text-slate-100 hover:ring-white/10",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Consistent glass panel header row. */
export function LibraryPanelHeader({
  icon,
  title,
  subtitle,
  actions,
  onDragStart,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onDragStart?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={cn(
        "library-glass-header flex select-none items-center gap-2",
        onDragStart && "cursor-grab active:cursor-grabbing",
      )}
      onMouseDown={onDragStart}
    >
      {onDragStart && <LibraryDragGrip />}
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-slate-300">
          {title}
        </p>
        {subtitle && (
          <p className="truncate text-[10px] normal-case tracking-normal text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-0.5">{actions}</div>}
    </div>
  );
}

/** Bottom-centered flow hint (seat select, etc.). */
export function SessionFlowHint({
  icon,
  children,
  accent = "emerald",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  accent?: "emerald" | "amber" | "sky";
}) {
  const accentRing =
    accent === "amber"
      ? "border-amber-400/20"
      : accent === "sky"
        ? "border-sky-400/20"
        : "border-emerald-400/20";
  const accentBg =
    accent === "amber"
      ? "bg-amber-500/15 text-amber-200"
      : accent === "sky"
        ? "bg-sky-500/15 text-sky-200"
        : "bg-emerald-500/15 text-emerald-200";

  return (
    <div
      className={cn(
        "library-glass-panel flex items-center gap-3 px-5 py-3",
        accentRing,
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-white/[0.06]",
          accentBg,
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-medium leading-snug text-slate-100">{children}</span>
    </div>
  );
}

type SessionStep = "library" | "seat" | "duration" | "focus";

const SESSION_STEPS: { id: SessionStep; label: string }[] = [
  { id: "library", label: "Library" },
  { id: "seat", label: "Seat" },
  { id: "duration", label: "Duration" },
  { id: "focus", label: "Focus" },
];

/** Lightweight progress through the pre-session flow. */
export function SessionStepIndicator({ active }: { active: SessionStep }) {
  const activeIdx = SESSION_STEPS.findIndex((s) => s.id === active);

  return (
    <div className="library-glass-panel flex items-center gap-1 px-3 py-1.5">
      {SESSION_STEPS.map((step, i) => {
        const done = i < activeIdx;
        const current = i === activeIdx;
        return (
          <div key={step.id} className="flex items-center gap-1">
            {i > 0 && <span className="mx-0.5 h-px w-2 bg-white/10" aria-hidden />}
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider transition",
                current
                  ? "bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/25"
                  : done
                    ? "text-slate-400"
                    : "text-slate-600",
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
