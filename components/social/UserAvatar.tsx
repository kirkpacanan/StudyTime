"use client";

import { PlayerAvatar } from "@/components/gamification/PlayerAvatar";
import { PresenceDot } from "./PresenceDot";
import type { PresenceStatus } from "@/lib/social/types";

/**
 * Avatar for another user (search result / friend / feed). Builds the same
 * deterministic seed used elsewhere (`userId + displayName`) and optionally
 * overlays a presence dot.
 */
export function UserAvatar({
  userId,
  displayName,
  avatarId,
  frameId,
  size = 44,
  presence,
}: {
  userId: string;
  displayName: string;
  avatarId?: string | null;
  frameId?: string | null;
  size?: number;
  presence?: PresenceStatus;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PlayerAvatar
        avatarId={avatarId ?? undefined}
        frameId={frameId ?? undefined}
        seed={userId + displayName}
        size={size}
      />
      {presence ? (
        <PresenceDot
          status={presence}
          size={Math.max(10, Math.round(size * 0.28))}
          className="absolute bottom-0 right-0"
        />
      ) : null}
    </div>
  );
}
