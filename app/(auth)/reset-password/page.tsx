"use client";

import { StudyTimeWordmark } from "@/components/StudyTimeLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle, ShieldAlert } from "lucide-react";
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

type PageState = "verifying" | "ready" | "success" | "invalid";

export default function ResetPasswordPage() {
  const reduce = useReducedMotion();
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>("verifying");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Supabase embeds the recovery tokens in the URL hash. The JS client
  // processes the hash automatically; we listen for the PASSWORD_RECOVERY
  // event to know when a valid recovery session is active.
  useEffect(() => {
    if (!isSupabaseEnabled()) {
      setPageState("invalid");
      return;
    }

    const supabase = getSupabaseBrowser();

    // Check if a recovery session is already set (page refresh case).
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setPageState("ready");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("ready");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setPageState("success");
    // Give the user a moment to read the success message, then redirect.
    setTimeout(() => router.replace("/login?reset=1"), 2200);
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

          {/* Verifying the recovery link */}
          {pageState === "verifying" ? (
            <motion.div
              key="verifying"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="py-4 text-center text-sm text-muted"
            >
              Verifying reset link…
            </motion.div>
          ) : null}

          {/* Invalid / expired link */}
          {pageState === "invalid" ? (
            <motion.div
              key="invalid"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease }}
              className="space-y-4 text-center"
            >
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
                  <ShieldAlert className="h-6 w-6 text-red-400" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight text-text">
                  Invalid or expired link
                </h1>
                <p className="max-w-xs text-sm text-muted">
                  This password reset link is no longer valid. Please request a
                  new one.
                </p>
              </div>
              <Link
                href="/forgot-password"
                className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-900/30 transition hover:bg-sky-500"
              >
                Request a new reset link
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white/10"
              >
                Back to sign in
              </Link>
            </motion.div>
          ) : null}

          {/* Password entry form */}
          {pageState === "ready" ? (
            <motion.div
              key="form"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.38, ease }}
            >
              <h1 className="text-xl font-semibold tracking-tight text-text">
                Set a new password
              </h1>
              <p className="mt-1 text-sm text-muted">
                Choose a strong password for your account.
              </p>

              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                <div>
                  <label
                    className="text-xs font-medium text-muted"
                    htmlFor="new-password"
                  >
                    New password
                  </label>
                  <PasswordInput
                    id="new-password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label
                    className="text-xs font-medium text-muted"
                    htmlFor="confirm-password"
                  >
                    Confirm new password
                  </label>
                  <PasswordInput
                    id="confirm-password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1"
                    required
                    minLength={6}
                  />
                </div>

                {err ? (
                  <motion.p
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-sm text-alert"
                  >
                    {err}
                  </motion.p>
                ) : null}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Updating…" : "Update password"}
                </Button>
              </form>
            </motion.div>
          ) : null}

          {/* Success */}
          {pageState === "success" ? (
            <motion.div
              key="success"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease }}
              className="flex flex-col items-center gap-3 py-2 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle className="h-6 w-6 text-emerald-400" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-text">
                Password updated!
              </h1>
              <p className="max-w-xs text-sm text-muted">
                Your password has been changed. Redirecting you to sign in…
              </p>
            </motion.div>
          ) : null}

        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
