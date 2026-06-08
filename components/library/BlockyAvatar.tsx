"use client";

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BlockyAvatarMesh, type BlockyAnimState, type BlockyAvatarMeshHandle } from "./BlockyAvatarMesh";
import { StatusBadge } from "./StatusBadge";
import type { AvatarStatus } from "./StatusBadge";
import type { BlockyAvatarConfig } from "@/lib/library/blocky-avatar";

type BlockyAvatarProps = {
  config: BlockyAvatarConfig;
  spawnPosition: [number, number, number];
  targetPosition: [number, number, number];
  targetRotation: number;
  status: AvatarStatus;
  focusScore: number;
  displayName: string;
  sessionDurationMs?: number;
  showStatusBadge?: boolean;
};

const WALK_SPEED = 4.2;
const LERP_ROTATION = 0.12;
const ARRIVE_THRESHOLD = 0.12;

function statusToAnim(status: AvatarStatus, walking: boolean): BlockyAnimState {
  if (walking) return "walk";
  if (status === "studying" || status === "break" || status === "completed") return "sit";
  return "idle";
}

/** Blocky avatar with Roblox-style walk / idle / sit and seat navigation. */
export function BlockyAvatar({
  config,
  spawnPosition,
  targetPosition,
  targetRotation,
  status,
  focusScore,
  displayName,
  sessionDurationMs,
  showStatusBadge = true,
}: BlockyAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<BlockyAvatarMeshHandle>(null);
  const currentPosRef = useRef(new THREE.Vector3(...spawnPosition));
  const hasArrivedRef = useRef(
    Math.abs(spawnPosition[0] - targetPosition[0]) < ARRIVE_THRESHOLD &&
      Math.abs(spawnPosition[2] - targetPosition[2]) < ARRIVE_THRESHOLD,
  );
  const walkingRef = useRef(false);
  const prevTargetRef = useRef(targetPosition);

  useEffect(() => {
    if (
      prevTargetRef.current[0] !== targetPosition[0] ||
      prevTargetRef.current[2] !== targetPosition[2]
    ) {
      hasArrivedRef.current = false;
      prevTargetRef.current = targetPosition;
    }
  }, [targetPosition]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const target = new THREE.Vector3(...targetPosition);

    if (!hasArrivedRef.current) {
      const dist = currentPosRef.current.distanceTo(target);
      if (dist < ARRIVE_THRESHOLD) {
        hasArrivedRef.current = true;
        walkingRef.current = false;
        currentPosRef.current.copy(target);
      } else {
        walkingRef.current = true;
        const step = Math.min(delta * WALK_SPEED, dist);
        const dir = target.clone().sub(currentPosRef.current).normalize();
        currentPosRef.current.addScaledVector(dir, step);
      }
    } else {
      walkingRef.current = false;
    }

    groupRef.current.position.copy(currentPosRef.current);

    const targetQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      targetRotation,
    );
    groupRef.current.quaternion.slerp(targetQ, LERP_ROTATION);

    meshRef.current?.setAnimState(statusToAnim(status, walkingRef.current));
  });

  return (
    <group ref={groupRef}>
      <BlockyAvatarMesh ref={meshRef} config={config} />
      {showStatusBadge && (
        <StatusBadge
          status={status}
          displayName={displayName}
          focusScore={focusScore}
          durationMs={sessionDurationMs}
          yOffset={2.0}
        />
      )}
    </group>
  );
}
