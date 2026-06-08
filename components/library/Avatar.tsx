"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { StatusBadge } from "./StatusBadge";
import type { AvatarStatus } from "./StatusBadge";

type AvatarProps = {
  avatarUrl: string;
  targetPosition: [number, number, number];
  targetRotation: number;
  status: AvatarStatus;
  focusScore: number;
  displayName: string;
  isLocalUser?: boolean;
  sessionDurationMs?: number;
};

const WALK_SPEED = 3.5;
const LERP_ROTATION = 0.1;
const ARRIVE_THRESHOLD = 0.1;

/**
 * Loads a Ready Player Me avatar GLB and drives idle/walk/sit animations
 * based on the current status and whether the avatar has reached its seat.
 *
 * If the Mixamo animation GLBs are not yet downloaded, only the avatar mesh
 * renders (static), with a graceful fallback.
 */
export function Avatar({
  avatarUrl,
  targetPosition,
  targetRotation,
  status,
  focusScore,
  displayName,
  isLocalUser = false,
  sessionDurationMs,
}: AvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const currentPosRef = useRef(new THREE.Vector3(...targetPosition));
  const isWalkingRef = useRef(false);
  const hasArrivedRef = useRef(false);

  const { scene: avatarScene } = useGLTF(avatarUrl);

  // Load animation GLBs — gracefully skip if not available.
  const idleGltf = useConditionalGltf("/animations/idle.glb");
  const walkGltf = useConditionalGltf("/animations/walk.glb");
  const sitGltf = useConditionalGltf("/animations/sit.glb");

  const animClips = useMemo(() => {
    const clips: THREE.AnimationClip[] = [];
    if (idleGltf?.animations?.length) {
      const clip = idleGltf.animations[0].clone();
      clip.name = "idle";
      clips.push(clip);
    }
    if (walkGltf?.animations?.length) {
      const clip = walkGltf.animations[0].clone();
      clip.name = "walk";
      clips.push(clip);
    }
    if (sitGltf?.animations?.length) {
      const clip = sitGltf.animations[0].clone();
      clip.name = "sit";
      clips.push(clip);
    }
    return clips;
  }, [idleGltf, walkGltf, sitGltf]);

  const { actions, mixer } = useAnimations(animClips, groupRef);
  const activeActionRef = useRef<string | null>(null);

  const clonedScene = useMemo(() => {
    const clone = avatarScene.clone(true);
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

  function playAction(name: string, fadeDuration = 0.4) {
    if (activeActionRef.current === name) return;
    const next = actions[name];
    if (!next) return;
    const prev = activeActionRef.current ? actions[activeActionRef.current] : null;
    if (prev) prev.crossFadeTo(next, fadeDuration, true);
    else next.reset().fadeIn(fadeDuration);
    next.play();
    activeActionRef.current = name;
  }

  // Start idle on mount.
  useEffect(() => {
    if (actions.idle) playAction("idle", 0.1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions.idle]);

  // When target changes, start walking.
  useEffect(() => {
    hasArrivedRef.current = false;
    isWalkingRef.current = true;
    if (actions.walk) playAction("walk");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPosition[0], targetPosition[2]]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    mixer.update(delta);

    const target = new THREE.Vector3(...targetPosition);

    if (!hasArrivedRef.current) {
      const dist = currentPosRef.current.distanceTo(target);
      if (dist < ARRIVE_THRESHOLD) {
        hasArrivedRef.current = true;
        isWalkingRef.current = false;
        currentPosRef.current.copy(target);
        // Play sit if studying, idle otherwise.
        const arrivedAnim = status === "studying" || status === "break" || status === "completed"
          ? "sit"
          : "idle";
        playAction(arrivedAnim);
      } else {
        const step = Math.min(delta * WALK_SPEED, dist);
        const dir = target.clone().sub(currentPosRef.current).normalize();
        currentPosRef.current.addScaledVector(dir, step);
      }
    }

    groupRef.current.position.copy(currentPosRef.current);

    // Lerp rotation toward target.
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

/**
 * Tries to load a GLTF; returns null if the file is not found.
 * Uses a suspense-safe pattern with error boundary fallback.
 */
function useConditionalGltf(path: string) {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useGLTF(path);
  } catch {
    return null;
  }
}
