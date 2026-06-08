"use client";

import { useMemo } from "react";
import { BlockyAvatar } from "./BlockyAvatar";
import {
  blockyAvatarFromSeed,
  parseBlockyAvatar,
} from "@/lib/library/blocky-avatar";
import type { LibraryPeer } from "@/hooks/useLibraryPresence";
import type { AvatarStatus } from "./StatusBadge";

type OtherUserAvatarProps = {
  peer: LibraryPeer;
  seatPosition: [number, number, number];
  seatRotation: number;
  showStatusBadge?: boolean;
};

export function OtherUserAvatar({
  peer,
  seatPosition,
  seatRotation,
  showStatusBadge = true,
}: OtherUserAvatarProps) {
  const status: AvatarStatus =
    peer.status === "studying"
      ? peer.focusPhase === "break"
        ? "break"
        : "studying"
      : peer.status === "completed"
      ? "completed"
      : "idle";

  const config = useMemo(
    () => parseBlockyAvatar(peer.avatarUrl) ?? blockyAvatarFromSeed(peer.userId),
    [peer.avatarUrl, peer.userId],
  );

  return (
    <BlockyAvatar
      config={config}
      spawnPosition={seatPosition}
      targetPosition={seatPosition}
      targetRotation={seatRotation}
      status={status}
      focusScore={peer.focusScore ?? 0}
      displayName={peer.displayName}
      sessionDurationMs={peer.sessionDurationMs}
      showStatusBadge={showStatusBadge}
    />
  );
}
