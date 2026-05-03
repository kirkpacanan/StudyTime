"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { signIn } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const { user, ready, refreshUser } = useAuth();
  const router = useRouter();
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
    const res = await signIn(email, password);
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
      <Card className="p-6 md:p-8 text-center text-sm text-muted">
        Preparing your workspace…
      </Card>
    );
  }

  return (
    <Card className="p-6 md:p-8">
      <h1 className="text-xl font-semibold text-text">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">
        Sign in to track focus and weekly performance.
      </p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
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
        </div>
        <div>
          <label className="text-xs font-medium text-muted" htmlFor="password">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
            required
          />
        </div>
        {err ? <p className="text-sm text-alert">{err}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-muted">
        Demo: <span className="font-mono">demo@studytime.app</span> /{" "}
        <span className="font-mono">demo1234</span>
      </p>
      <p className="mt-3 text-center text-sm text-muted">
        New here?{" "}
        <Link className="font-medium text-primary hover:underline" href="/signup">
          Create an account
        </Link>
      </p>
    </Card>
  );
}
