"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function FocusHubAnalyticsRedirectPage() {
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  useEffect(() => {
    router.replace(`/session/room/${roomId}/analytics`);
  }, [router, roomId]);
  return null;
}
