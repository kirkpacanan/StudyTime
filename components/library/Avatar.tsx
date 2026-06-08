"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { StatusBadge } from "./StatusBadge";
import type { AvatarStatus } from "./StatusBadge";

type AvatarProps = {
  avatarUrl: string;
  /** Where the avatar starts (library entrance). */
  spawnPosition: [number, number, number];
  targetPosition: [number, number, number];
  targetRotation: number;
  status: AvatarStatus;
  focusScore: number;
  displayName: string;
  isLocalUser?: boolean;
  sessionDurationMs?: number;
  /** Pre-loaded animation clips (idle, walk, sit). Leave empty for static avatar. */
  animationClips?: THREE.AnimationClip[];
};

const WALK_SPEED = 3.5;
const LERP_ROTATION = 0.1;
const ARRIVE_THRESHOLD = 0.1;

/**
 * Loads a Ready Player Me avatar GLB and optionally drives idle/walk/sit animations.
 *
 * Animations are only applied when `animationClips` is provided and non-empty.
 * Without clips the avatar renders statically — this is the safe default until
 * the Mixamo GLB files are placed in /public/animations/.
 */
export function Avatar({
  avatarUrl,
  spawnPosition,
  targetPosition,
  targetRotation,
  status,
  focusScore,
  displayName,
  isLocalUser = false,
  sessionDurationMs,
  animationClips = [],
}: AvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const currentPosRef = useRef(new THREE.Vector3(...spawnPosition));
  const hasArrivedRef = useRef(true);
  const walkingRef = useRef(false);
  const bobPhaseRef = useRef(0);

  const { scene: avatarScene } = useGLTF(avatarUrl);

  const { actions, mixer } = useAnimations(animationClips, groupRef);
  const activeActionRef = useRef<string | null>(null);

  const clonedScene = useMemo(() => {
    const clone = avatarScene.clone(true);
    // VALID / RPM avatars vary in scale — normalize to ~1.8m tall.
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 1.8 / maxDim;
      clone.scale.setScalar(scale);
    }
    clone.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else {
          mesh.material = (mesh.material as THREE.Material).clone();
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clone;
  }, [avatarScene]);

  const playAction = (name: string, fadeDuration = 0.4) => {
    if (activeActionRef.current === name) return;
    const next = actions[name];
    if (!next) return;
    const prev = activeActionRef.current ? actions[activeActionRef.current] : null;
    if (prev) prev.crossFadeTo(next, fadeDuration, true);
    else next.reset().fadeIn(fadeDuration);
    next.play();
    activeActionRef.current = name;
  };

  // Start idle on mount (only if clip is available).
  useEffect(() => {
    if (actions.idle) playAction("idle", 0.1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions.idle]);

  // Walk when seat target changes, then sit on arrival.
  useEffect(() => {
    const atTarget =
      Math.abs(currentPosRef.current.x - targetPosition[0]) < ARRIVE_THRESHOLD &&
      Math.abs(currentPosRef.current.z - targetPosition[2]) < ARRIVE_THRESHOLD;
    if (atTarget) {
      hasArrivedRef.current = true;
      walkingRef.current = false;
      const arrivedAnim =
        status === "studying" || status === "break" || status === "completed"
          ? "sit"
          : "idle";
      playAction(arrivedAnim);
      return;
    }
    hasArrivedRef.current = false;
    walkingRef.current = true;
    if (actions.walk) playAction("walk");
    else if (actions.idle) playAction("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPosition[0], targetPosition[2], status]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (animationClips.length > 0) mixer.update(delta);

    const target = new THREE.Vector3(...targetPosition);

    if (!hasArrivedRef.current) {
      const dist = currentPosRef.current.distanceTo(target);
      if (dist < ARRIVE_THRESHOLD) {
        hasArrivedRef.current = true;
        walkingRef.current = false;
        currentPosRef.current.copy(target);
        const arrivedAnim =
          status === "studying" || status === "break" || status === "completed"
            ? "sit"
            : "idle";
        playAction(arrivedAnim);
      } else {
        walkingRef.current = true;
        const step = Math.min(delta * WALK_SPEED, dist);
        const dir = target.clone().sub(currentPosRef.current).normalize();
        currentPosRef.current.addScaledVector(dir, step);
      }
    }

    const yBob =
      walkingRef.current && animationClips.length === 0
        ? Math.sin((bobPhaseRef.current += delta * 10)) * 0.04
        : 0;
    groupRef.current.position.set(
      currentPosRef.current.x,
      currentPosRef.current.y + yBob,
      currentPosRef.current.z,
    );

    const targetQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      targetRotation,
    );
    groupRef.current.quaternion.slerp(targetQ, LERP_ROTATION);
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
      <StatusBadge
        status={status}
        displayName={displayName}
        focusScore={focusScore}
        durationMs={sessionDurationMs}
        yOffset={2.2}
      />
    </group>
  );
}
