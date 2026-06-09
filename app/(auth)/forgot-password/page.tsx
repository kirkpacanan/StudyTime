"use client";

import { StudyTimeWordmark } from "@/components/StudyTimeLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { resetPasswordForEmail } from "@/lib/auth";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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

export default function ForgotPasswordPage() {
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await resetPasswordForEmail(email);
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setSent(true);
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

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="success"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease }}
              className="space-y-4"
            >
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                  <CheckCircle className="h-6 w-6 text-emerald-400" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight text-text">
                  Check your email
                </h1>
                <p className="max-w-xs text-sm text-muted">
                  We sent a password reset link to{" "}
                  <span className="font-medium text-text">{email}</span>. Follow
                  the link to set a new password.
                </p>
                <p className="text-xs text-muted">
                  Didn't receive it? Check your spam folder or{" "}
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="font-medium text-primary underline-offset-4 transition hover:underline dark:text-cyan-300"
                  >
                    try again
                  </button>
                  .
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white/10"
              >
                Back to sign in
              </Link>
            </motion.div>
          ) : (
            <motion.div key="form" className="space-y-0">
              <motion.h1
                variants={item}
                className="text-xl font-semibold tracking-tight text-text"
              >
                Forgot your password?
              </motion.h1>
              <motion.p variants={item} className="mt-1 text-sm text-muted">
                Enter the email address for your account and we'll send you a
                reset link.
              </motion.p>

              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                <motion.div variants={item}>
                  <label
                    className="text-xs font-medium text-muted"
                    htmlFor="email"
                  >
                    Email address
                  </label>
                  <div className="relative mt-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
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
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending…" : "Send reset link"}
                  </Button>
                </motion.div>
              </form>

              <motion.p
                variants={item}
                className="mt-4 text-center text-sm text-muted"
              >
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="font-medium text-primary underline-offset-4 transition hover:underline dark:text-cyan-300"
                >
                  Sign in
                </Link>
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
