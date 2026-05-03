"use client";

import { AppBackdrop } from "@/components/AppBackdrop";
import { PageTransition } from "@/components/PageTransition";
import { StudyTimeLogo } from "@/components/StudyTimeLogo";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function Splash() {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-6">
      <AppBackdrop />
      <motion.div
        className="relative z-10 max-w-sm text-center"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mx-auto mb-4 flex justify-center">
          <motion.div
            animate={
              reduce
                ? {}
                : { scale: [1, 1.04, 1], rotate: [0, 2, -2, 0] }
            }
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <StudyTimeLogo
              size={44}
              className="[filter:drop-shadow(0_10px_28px_rgba(79,134,247,0.28))]"
            />
          </motion.div>
        </div>
        <p className="text-sm font-medium text-text">Loading StudyTime…</p>
        <p className="mt-1 text-xs text-muted">
          Preparing your calm study workspace.
        </p>
      </motion.div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready) return <Splash />;
  if (!user) return null;

  return (
    <>
      <AppBackdrop />
      <div className="relative z-0 flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col md:ml-0">
          <Topbar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </>
  );
}
