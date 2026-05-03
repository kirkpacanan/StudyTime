"use client";

import { PageTransition } from "@/components/PageTransition";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, useReducedMotion } from "framer-motion";

export function AuthScenery({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();

  return (
    <div className="relative isolate min-h-screen bg-gradient-to-br from-bg via-primary-soft/30 to-bg dark:from-[#050810] dark:via-slate-950 dark:to-[#0a1020]">
      {/* Clip only decorative layers so burst icons (portal target below) are not clipped mid-flight */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(79,134,247,0.22),transparent_55%)] dark:bg-[radial-gradient(ellipse_100%_70%_at_50%_-10%,rgba(34,211,238,0.12),transparent_50%)]" />

        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage: `linear-gradient(var(--auth-grid-major-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--auth-grid-major-line) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `linear-gradient(var(--auth-grid-minor-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--auth-grid-minor-line) 1px, transparent 1px)`,
            backgroundSize: "13px 13px",
          }}
        />

        {!reduce && (
          <motion.div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-60 dark:via-cyan-400/50"
            animate={{ top: ["0%", "100%", "0%"], opacity: [0.15, 0.45, 0.15] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {!reduce && (
          <>
            <motion.div
              className="absolute -left-28 top-1/4 h-80 w-80 rounded-full bg-primary/35 blur-3xl dark:bg-cyan-500/20"
              animate={{ x: [0, 36, 0], y: [0, -24, 0], scale: [1, 1.08, 1] }}
              transition={{
                duration: 16,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute -right-24 bottom-1/4 h-96 w-96 rounded-full bg-success/30 blur-3xl dark:bg-indigo-500/25"
              animate={{ x: [0, -28, 0], y: [0, 28, 0], scale: [1, 1.06, 1] }}
              transition={{
                duration: 19,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute left-1/3 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl dark:bg-violet-500/20"
              animate={{ opacity: [0.5, 0.85, 0.5], y: [0, 30, 0] }}
              transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(15,23,42,0.06)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.55)_100%)]" />

        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent dark:via-cyan-400/40" />
      </div>

      <ThemeToggle variant="floating" />

      {/* Login burst icons portal target: below z-10 auth card, outside overflow clip */}
      <div
        id="auth-viewport-layer"
        className="pointer-events-none fixed inset-0 z-[8] overflow-visible"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 pt-20 md:pt-10">
        <div className="w-full max-w-md">
          <PageTransition>{children}</PageTransition>
        </div>
      </div>
    </div>
  );
}
