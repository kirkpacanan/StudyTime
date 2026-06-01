"use client";

import { cn } from "@/lib/cn";
import type { RankDef } from "@/lib/gamification/ranks";

// All cosmetic gradient classes (rank + theme) must appear as literal strings
// in a scanned component file so Tailwind JIT compiles them into the CSS bundle.
// Storing them only in lib/ data files is not sufficient — Next.js hot-reload
// doesn't re-trigger Tailwind scanning for lib/ changes the same way it does for
// component files. DO NOT collapse these strings or compute them dynamically.
const _COSMETIC_GRADIENT_SAFELIST = [
  // ── Rank badge gradients ──────────────────────────────────────────────────
  "from-stone-400 to-stone-600",              // Brainrot Victim    — gray
  "from-emerald-400 to-emerald-600",          // Tryhard Apprentice — green
  "from-blue-400 to-blue-600",               // Locked In          — blue
  "from-purple-400 to-purple-700",           // Main Character     — purple
  "from-orange-400 to-orange-600",           // No Cap Scholar     — orange
  "from-red-400 to-red-700",                 // Academic Weapon    — red
  "from-amber-400 to-yellow-600",            // Rizz Professor     — gold
  "from-slate-300 via-slate-400 to-slate-500", // Study GOAT       — platinum
  // ── Theme swatch previews ────────────────────────────────────────────────
  "from-sky-400 to-blue-600",                // theme_default       — sky blue
  "from-emerald-400 to-teal-600",            // theme_forest        — forest green
  "from-indigo-400 to-blue-600",             // theme_focus_pack    — indigo
  "from-fuchsia-400 to-purple-600",          // theme_main_banner   — purple
  "from-amber-400 to-rose-500",              // theme_sunset        — sunset
  "from-yellow-300 via-amber-400 to-yellow-600", // theme_goat_gold — gold
] as const;

export function RankChip({
  rank,
  level,
  prestige = 0,
  className,
}: {
  rank: RankDef;
  level?: number;
  prestige?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white",
        "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.25)]",
        rank.gradient,
        className,
      )}
    >
      {prestige > 0 ? (
        <span className="rounded-sm bg-black/20 px-1 text-[9px] leading-tight backdrop-blur-sm">
          ★{prestige}
        </span>
      ) : null}
      {rank.title}
      {level != null ? <span className="opacity-75">· Lv {level}</span> : null}
    </span>
  );
}
