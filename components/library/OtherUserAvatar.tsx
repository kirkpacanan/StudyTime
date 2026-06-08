"use client";

import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { Avatar } from "./Avatar";
import { StatusBadge } from "./StatusBadge";
import type { LibraryPeer } from "@/hooks/useLibraryPresence";
import type { AvatarStatus } from "./StatusBadge";

type OtherUserAvatarProps = {
  peer: LibraryPeer;
  seatPosition: [number, number, number];
  seatRotation: number;
};

/** Simple capsule + sphere fallback when RPM GLB is unavailable. */
function SimplePeer({
  position,
  rotation,
  peer,
}: {
  position: [number, number, number];
  rotation: number;
  peer: LibraryPeer;
}) {
  const color = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < peer.userId.length; i++) {
      hash = peer.userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 55%)`;
  }, [peer.userId]);

  const status: AvatarStatus =
    peer.status === "studying"
      ? peer.focusPhase === "break"
        ? "break"
        : "studying"
      : peer.status === "completed"
      ? "completed"
      : "idle";

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.25, 0.8, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 1.85, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#f4c99e" roughness={0.8} />
      </mesh>
      <StatusBadge
        status={status}
        displayName={peer.displayName}
        focusScore={peer.focusScore}
        durationMs={peer.sessionDurationMs}
        yOffset={2.2}
      />
    </group>
  );
}

export function OtherUserAvatar({ peer, seatPosition, seatRotation }: OtherUserAvatarProps) {
  const status: AvatarStatus =
    peer.status === "studying"
      ? peer.focusPhase === "break"
        ? "break"
        : "studying"
      : peer.status === "completed"
      ? "completed"
      : "idle";

  if (!peer.avatarUrl) {
    return (
      <SimplePeer
        position={seatPosition}
        rotation={seatRotation}
        peer={peer}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <SimplePeer
          position={seatPosition}
          rotation={seatRotation}
          peer={peer}
        />
      }
    >
      <Avatar
        avatarUrl={peer.avatarUrl}
        targetPosition={seatPosition}
        targetRotation={seatRotation}
        status={status}
        focusScore={peer.focusScore ?? 0}
        displayName={peer.displayName}
        sessionDurationMs={peer.sessionDurationMs}
      />
    </Suspense>
  );
}
