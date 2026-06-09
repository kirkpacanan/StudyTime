"use client";

import { CreateActivitySheet } from "@/components/focus-hub/CreateActivitySheet";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateActivityPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <CreateActivitySheet
      open={open}
      roomId={roomId}
      onClose={() => {
        setOpen(false);
        router.back();
      }}
      onCreated={(activity) => {
        router.push(`/focus-hub/${roomId}/activities/${activity.id}`);
      }}
    />
  );
}
