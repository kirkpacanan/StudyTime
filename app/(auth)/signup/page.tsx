"use client";

import { StudyTimeWordmark } from "@/components/StudyTimeLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { signUp } from "@/lib/auth";
import {
  isSupabaseEnabled,
  supabaseRequiredMessage,
} from "@/lib/supabase/config";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ease = [0.16, 1, 0.3, 1] as const;

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease },
  },
};

export default function SignupPage() {
  const { user, ready, refreshUser } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await signUp(email, password, name);
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    refreshUser();
    router.replace("/dashboard");
  }

  if (!ready) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease }}
      >
        <Card
          variant="auth"
          className="auth-glass auth-glow-ring p-6 text-center text-sm text-muted md:p-8"
        >
          Preparing your workspace…
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-0"
    >
      <Card variant="auth" className="auth-glass auth-glow-ring overflow-hidden p-6 md:p-8">
        <motion.div variants={item}>
          <StudyTimeWordmark logoSize={44} className="mb-6" />
        </motion.div>
        <motion.h1
          variants={item}
          className="text-xl font-semibold tracking-tight text-text"
        >
          Create your account
        </motion.h1>
        <motion.p variants={item} className="mt-1 text-sm text-muted">
          Start monitoring focus and study performance.
        </motion.p>
        {!isSupabaseEnabled() ? (
          <motion.p
            variants={item}
            className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/90 p-3 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100"
          >
            {supabaseRequiredMessage()}
          </motion.p>
        ) : null}
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <motion.div variants={item}>
            <label className="text-xs font-medium text-muted" htmlFor="name">
              Name
            </label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
              placeholder="Alex"
            />
          </motion.div>
          <motion.div variants={item}>
            <label className="text-xs font-medium text-muted" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
              required
            />
          </motion.div>
          <motion.div variants={item}>
            <label
              className="text-xs font-medium text-muted"
              htmlFor="password"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
              required
              minLength={6}
            />
          </motion.div>
          {err ? (
            <motion.p
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm text-alert"
            >
              {err}
            </motion.p>
          ) : null}
          <motion.div variants={item}>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !isSupabaseEnabled()}
            >
              {loading ? "Creating…" : "Sign up"}
            </Button>
          </motion.div>
        </form>
        <motion.p
          variants={item}
          className="mt-4 text-center text-sm text-muted"
        >
          Already have an account?{" "}
          <Link
            className="font-medium text-primary underline-offset-4 transition hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </motion.p>
      </Card>
    </motion.div>
  );
}
