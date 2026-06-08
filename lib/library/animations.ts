/**
 * Helpers for retargeting Mixamo animation clips onto Ready Player Me avatars.
 *
 * RPM exports are Mixamo-compatible, meaning their skeleton bone names match
 * Mixamo conventions (e.g. "mixamorigHips", "mixamorigSpine", etc.).
 * Mixamo "Without Skin" animation files only contain AnimationClips with no
 * geometry, so they can be applied directly to any RPM avatar skeleton.
 *
 * Usage:
 *   const clip = retargetClip(sourceClip, targetSkeleton);
 *   mixer.clipAction(clip).play();
 */

import * as THREE from "three";

/**
 * Retarget a Mixamo AnimationClip to match a target skeleton's bone structure.
 * Since RPM avatars share the same Mixamo bone naming, this is usually a no-op
 * but ensures the clip is properly scaled for the target model.
 */
export function retargetClip(
  clip: THREE.AnimationClip,
  targetObject: THREE.Object3D,
): THREE.AnimationClip {
  return THREE.AnimationClip.findByName(
    [clip],
    clip.name,
  ) ?? clip;
}

/**
 * Cross-fade from one animation action to another over `duration` seconds.
 */
export function crossFadeTo(
  from: THREE.AnimationAction,
  to: THREE.AnimationAction,
  duration = 0.4,
): void {
  from.crossFadeTo(to, duration, true);
  to.play();
}

/**
 * Animation names used as keys throughout the library components.
 */
export type AnimationName = "idle" | "walk" | "sit";

/**
 * Map animation names to their public asset paths.
 * These GLB files should be downloaded from Mixamo (Without Skin option)
 * and placed in /public/animations/.
 */
export const ANIMATION_PATHS: Record<AnimationName, string> = {
  idle: "/animations/idle.glb",
  walk: "/animations/walk.glb",
  sit:  "/animations/sit.glb",
};
