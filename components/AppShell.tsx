"use client";

import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-xl bg-primary-soft" />
        <p className="text-sm font-medium text-text">Loading StudyTime…</p>
        <p className="mt-1 text-xs text-muted">
          Preparing your calm study workspace.
        </p>
      </div>
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
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col md:ml-0">
        <Topbar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
