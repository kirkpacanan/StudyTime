"use client";

import { cn } from "@/lib/cn";
import { ModalBackdrop, ModalRoot } from "@/components/ui/modal-portal";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Star } from "lucide-react";
import { useEffect } from "react";

// ── Confirmation modal ────────────────────────────────────────────────────────

interface PrestigeConfirmModalProps {
  open: boolean;
  currentPrestige: number;
  busy: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PrestigeConfirmModal({
  open,
  currentPrestige,
  busy,
  error,
  onConfirm,
  onCancel,
}: PrestigeConfirmModalProps) {
  const nextPrestige = currentPrestige + 1;
  const xpBonus = nextPrestige * 10;

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, busy, onCancel]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <ModalRoot>
      <AnimatePresence>
        {open && (
          <motion.div
            key="prestige-confirm-overlay"
            className="fixed inset-0 z-[100] flex min-h-[100dvh] w-full items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <ModalBackdrop onClick={!busy ? onCancel : undefined} />

            {/* Dialog */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="prestige-dialog-title"
              className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-white/20 bg-white/85 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85"
              initial={{ scale: 0.88, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
            >
            {/* Amber top bar */}
            <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500" />

            <div className="p-6">
              {/* Header */}
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/15">
                  <Star className="h-5 w-5 text-amber-500" fill="currentColor" />
                </div>
                <div>
                  <h2
                    id="prestige-dialog-title"
                    className="text-base font-bold text-text"
                  >
                    Ready to Prestige?
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Irreversible — your XP and level will reset.
                  </p>
                </div>
              </div>

              {/* Resets */}
              <div className="mb-3 rounded-xl border border-red-400/25 bg-red-500/8 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-red-500">
                  Resets
                </p>
                <div className="space-y-1.5 text-xs text-muted">
                  {(["XP → 0", "Level → 1"] as const).map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400/70" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Preserved */}
              <div className="mb-3 rounded-xl border border-emerald-400/25 bg-emerald-500/8 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  Preserved
                </p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                  {[
                    "Cosmetics & loadout",
                    "Achievements",
                    "Streak",
                    "Session history",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-1.5 text-xs text-muted"
                    >
                      <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Gains */}
              <div className="mb-5 rounded-xl border border-amber-400/25 bg-amber-500/8 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  You earn
                </p>
                <div className="space-y-1.5 text-xs text-muted">
                  <div className="flex items-center gap-1.5">
                    <Star className="h-3 w-3 shrink-0 text-amber-500" />
                    +{xpBonus}% XP bonus on every future session
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Star className="h-3 w-3 shrink-0 text-amber-500" />
                    ★{nextPrestige} badge on your rank chip
                  </div>
                  {currentPrestige === 0 && (
                    <div className="flex items-center gap-1.5">
                      <Star className="h-3 w-3 shrink-0 text-amber-500" />
                      Prestige Halo frame unlocked
                    </div>
                  )}
                </div>
              </div>

              {/* Inline error */}
              {error ? (
                <p className="mb-3 rounded-lg border border-red-400/30 bg-red-500/8 px-3 py-2 text-xs text-red-500">
                  {error}
                </p>
              ) : null}

              {/* Actions */}
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-white/45 bg-white/30 py-2.5 text-sm font-semibold text-text transition hover:bg-white/45 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={busy}
                  className={cn(
                    "flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition",
                    "bg-gradient-to-r from-amber-500 to-yellow-500",
                    "shadow-[0_4px_16px_-4px_rgba(245,158,11,0.55)]",
                    "hover:from-amber-600 hover:to-yellow-600",
                    "disabled:opacity-60",
                  )}
                >
                  {busy ? "Prestiging…" : "Prestige →"}
                </button>
              </div>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalRoot>
  );
}

// ── Celebration overlay ───────────────────────────────────────────────────────

// Pre-computed particle specs — deterministic so no hydration mismatch.
const PARTICLES = Array.from({ length: 32 }, (_, i) => {
  const angle = (i / 32) * 360 + (i % 4) * 11.25;
  const spread = 80 + (i % 6) * 28;
  const size = 5 + (i % 5) * 3.5;
  const delay = (i % 8) * 0.055;
  const duration = 0.85 + (i % 5) * 0.15;
  return { id: i, angle, spread, size, delay, duration };
});

const AUTO_DISMISS_MS = 4500;

interface PrestigeCelebrationProps {
  show: boolean;
  newPrestige: number;
  onDismiss: () => void;
}

export function PrestigeCelebration({
  show,
  newPrestige,
  onDismiss,
}: PrestigeCelebrationProps) {
  // Auto-dismiss
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [show, onDismiss]);

  // Dismiss on Escape
  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [show, onDismiss]);

  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  return (
    <ModalRoot>
      <AnimatePresence>
        {show && (
          <motion.div
            key="prestige-celebration"
            className="fixed inset-0 z-[100] flex min-h-[100dvh] w-full cursor-pointer items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onDismiss}
            role="status"
            aria-live="polite"
            aria-label={`Prestige ${newPrestige} achieved — click to dismiss`}
          >
            <ModalBackdrop
              className="bg-black/78 dark:bg-black/80"
              label={`Prestige ${newPrestige} achieved — click to dismiss`}
              onClick={onDismiss}
            />

          {/* Star particles */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {PARTICLES.map((p) => {
              const rad = (p.angle * Math.PI) / 180;
              return (
                <motion.div
                  key={p.id}
                  className="absolute"
                  initial={{ opacity: 0.9, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: [0.9, 1, 0],
                    scale: [0, 1.4, 0.5],
                    x: Math.cos(rad) * p.spread,
                    y: Math.sin(rad) * p.spread,
                  }}
                  transition={{
                    duration: p.duration,
                    delay: p.delay,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <Star
                    className="text-amber-400"
                    style={{ width: p.size, height: p.size }}
                    fill="currentColor"
                  />
                </motion.div>
              );
            })}
          </div>

          {/* Secondary ring of smaller particles at a longer distance */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {PARTICLES.filter((_, i) => i % 2 === 0).map((p) => {
              const rad = ((p.angle + 180 / 32) * Math.PI) / 180;
              return (
                <motion.div
                  key={`outer-${p.id}`}
                  className="absolute"
                  initial={{ opacity: 0.7, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: [0.7, 0.9, 0],
                    scale: [0, 1, 0.3],
                    x: Math.cos(rad) * (p.spread * 1.6),
                    y: Math.sin(rad) * (p.spread * 1.6),
                  }}
                  transition={{
                    duration: p.duration * 1.3,
                    delay: p.delay + 0.12,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <Star
                    className="text-yellow-300/70"
                    style={{ width: p.size * 0.6, height: p.size * 0.6 }}
                    fill="currentColor"
                  />
                </motion.div>
              );
            })}
          </div>

          {/* Central card */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-5 rounded-2xl border border-white/15 bg-white/10 px-12 py-10 text-center shadow-2xl backdrop-blur-xl"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.88, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 230,
              damping: 20,
              delay: 0.05,
            }}
          >
            {/* Big star + prestige badge */}
            <motion.div
              className="relative"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 280, damping: 22 }}
            >
              <motion.span
                className="block select-none text-[5.5rem] leading-none"
                animate={{ rotate: [0, -12, 12, -6, 6, 0] }}
                transition={{ delay: 0.3, duration: 0.65, ease: "easeInOut" }}
              >
                ⭐
              </motion.span>
              <motion.span
                className="absolute -bottom-1 -right-4 rounded-full bg-amber-500 px-2.5 py-0.5 text-sm font-black text-white shadow-lg"
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  delay: 0.52,
                  type: "spring",
                  stiffness: 480,
                  damping: 18,
                }}
              >
                ★{newPrestige}
              </motion.span>
            </motion.div>

            {/* Headline */}
            <motion.div
              className="space-y-1.5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.4 }}
            >
              <h2 className="text-2xl font-extrabold tracking-tight text-white">
                You&apos;ve Prestiged!
              </h2>
              <p className="font-semibold text-amber-300">
                Prestige {newPrestige} &middot; +{newPrestige * 10}% XP bonus
                active
              </p>
              <p className="text-sm text-white/55">
                XP reset to 0. Time to climb again.
              </p>
            </motion.div>

            {/* Progress bar (empties visually to reinforce the reset) */}
            <motion.div
              className="h-1.5 w-40 overflow-hidden rounded-full bg-white/15"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ delay: 0.7, duration: 1.8, ease: "easeInOut" }}
              />
            </motion.div>

            {/* Dismiss hint */}
            <motion.p
              className="text-xs text-white/35"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
            >
              Tap anywhere to dismiss
            </motion.p>
          </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalRoot>
  );
}
