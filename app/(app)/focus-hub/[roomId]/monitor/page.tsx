"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function FocusHubMonitorRedirectPage() {
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  useEffect(() => {
    router.replace(`/session/room/${roomId}/monitor`);
  }, [router, roomId]);
  return null;
}
