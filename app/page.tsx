"use client";

import { AppBackdrop } from "@/components/AppBackdrop";
import { StudyTimeLogo } from "@/components/StudyTimeLogo";
import { useAuth } from "@/hooks/useAuth";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [ready, user, router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <AppBackdrop />
      <motion.div
        className="relative z-10 flex flex-col items-center gap-3 px-6 text-center"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          animate={
            reduce ? {} : { rotate: [0, 6, -6, 0], scale: [1, 1.03, 1] }
          }
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <StudyTimeLogo
            size={40}
            className="[filter:drop-shadow(0_8px_24px_rgba(79,134,247,0.25))]"
          />
        </motion.div>
        <p className="text-sm text-muted">Opening StudyTime…</p>
      </motion.div>
    </div>
  );
}
