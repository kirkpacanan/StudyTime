"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { signUp } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignupPage() {
  const { user, ready, refreshUser } = useAuth();
  const router = useRouter();
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
      <Card className="p-6 md:p-8 text-center text-sm text-muted">
        Preparing your workspace…
      </Card>
    );
  }

  return (
    <Card className="p-6 md:p-8">
      <h1 className="text-xl font-semibold text-text">Create your account</h1>
      <p className="mt-1 text-sm text-muted">
        Start monitoring focus and study performance.
      </p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
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
        </div>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
            required
            minLength={6}
          />
        </div>
        {err ? <p className="text-sm text-alert">{err}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating…" : "Sign up"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link className="font-medium text-primary hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
