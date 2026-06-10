"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function JoinRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const code = searchParams.get("code");
    router.replace(code ? `/session/join?code=${encodeURIComponent(code)}` : "/session/join");
  }, [router, searchParams]);
  return null;
}

export default function FocusHubJoinRedirectPage() {
  return (
    <Suspense fallback={null}>
      <JoinRedirect />
    </Suspense>
  );
}
