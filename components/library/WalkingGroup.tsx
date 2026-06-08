"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const WALK_SPEED = 3.5;
const ARRIVE_THRESHOLD = 0.1;
const LERP_ROTATION = 0.1;

type WalkingGroupProps = {
  spawnPosition: [number, number, number];
  targetPosition: [number, number, number];
  targetRotation: number;
  children: React.ReactNode;
};

/** Lerps a group from spawn to target — used for fallback avatars without GLB. */
export function WalkingGroup({
  spawnPosition,
  targetPosition,
  targetRotation,
  children,
}: WalkingGroupProps) {
  const groupRef = useRef<THREE.Group>(null);
  const currentPosRef = useRef(new THREE.Vector3(...spawnPosition));
  const hasArrivedRef = useRef(
    Math.abs(spawnPosition[0] - targetPosition[0]) < ARRIVE_THRESHOLD &&
      Math.abs(spawnPosition[2] - targetPosition[2]) < ARRIVE_THRESHOLD,
  );
  const prevTargetRef = useRef(targetPosition);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (
      prevTargetRef.current[0] !== targetPosition[0] ||
      prevTargetRef.current[2] !== targetPosition[2]
    ) {
      hasArrivedRef.current = false;
      prevTargetRef.current = targetPosition;
    }

    const target = new THREE.Vector3(...targetPosition);

    if (!hasArrivedRef.current) {
      const dist = currentPosRef.current.distanceTo(target);
      if (dist < ARRIVE_THRESHOLD) {
        hasArrivedRef.current = true;
        currentPosRef.current.copy(target);
      } else {
        const step = Math.min(delta * WALK_SPEED, dist);
        const dir = target.clone().sub(currentPosRef.current).normalize();
        currentPosRef.current.addScaledVector(dir, step);
      }
    }

    groupRef.current.position.copy(currentPosRef.current);

    const targetQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      targetRotation,
    );
    groupRef.current.quaternion.slerp(targetQ, LERP_ROTATION);
  });

  return <group ref={groupRef}>{children}</group>;
}
