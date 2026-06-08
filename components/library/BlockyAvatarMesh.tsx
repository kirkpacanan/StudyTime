"use client";

import { useRef, useImperativeHandle, forwardRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BlockyAvatarConfig } from "@/lib/library/blocky-avatar";
import { BlockyFace, BlockyHair } from "./BlockyAvatarParts";

export type BlockyAnimState = "idle" | "walk" | "sit";

export type BlockyAvatarMeshHandle = {
  setAnimState: (state: BlockyAnimState) => void;
};

type BlockyAvatarMeshProps = {
  config: BlockyAvatarConfig;
  animState?: BlockyAnimState;
};

/** Hip height when standing (feet touch y=0) and when seated on a 0.45m stool. */
const HIP_STAND = 0.75;
const HIP_SIT = 0.45;

/**
 * Classic R6-style blocky character built from boxes.
 * Legs are parented to the torso so hips stay connected during walk / sit.
 */
export const BlockyAvatarMesh = forwardRef<BlockyAvatarMeshHandle, BlockyAvatarMeshProps>(
  function BlockyAvatarMesh({ config, animState = "idle" }, ref) {
    const torsoRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);
    const animStateRef = useRef<BlockyAnimState>(animState);
    const walkPhaseRef = useRef(0);
    const idlePhaseRef = useRef(0);

    useEffect(() => {
      animStateRef.current = animState;
    }, [animState]);

    useImperativeHandle(ref, () => ({
      setAnimState: (state) => {
        animStateRef.current = state;
      },
    }));

    useFrame((_, delta) => {
      const state = animStateRef.current;
      const torso = torsoRef.current;
      const lArm = leftArmRef.current;
      const rArm = rightArmRef.current;
      const lLeg = leftLegRef.current;
      const rLeg = rightLegRef.current;
      if (!torso || !lArm || !rArm || !lLeg || !rLeg) return;

      if (state === "walk") {
        walkPhaseRef.current += delta * 14;
        const swing = Math.sin(walkPhaseRef.current) * 0.75;
        lLeg.rotation.x = swing;
        rLeg.rotation.x = -swing;
        lArm.rotation.x = -swing * 0.65;
        rArm.rotation.x = swing * 0.65;
        torso.position.y = HIP_STAND + Math.abs(Math.sin(walkPhaseRef.current * 2)) * 0.035;
        torso.position.z = THREE.MathUtils.lerp(torso.position.z, 0, 0.18);
        torso.rotation.x = THREE.MathUtils.lerp(torso.rotation.x, 0, 0.18);
      } else if (state === "sit") {
        lLeg.rotation.x = THREE.MathUtils.lerp(lLeg.rotation.x, -Math.PI / 2.15, 0.2);
        rLeg.rotation.x = THREE.MathUtils.lerp(rLeg.rotation.x, -Math.PI / 2.15, 0.2);
        lArm.rotation.x = THREE.MathUtils.lerp(lArm.rotation.x, -0.35, 0.15);
        rArm.rotation.x = THREE.MathUtils.lerp(rArm.rotation.x, -0.35, 0.15);
        torso.position.y = THREE.MathUtils.lerp(torso.position.y, HIP_SIT, 0.18);
        torso.position.z = THREE.MathUtils.lerp(torso.position.z, 0.1, 0.15);
        torso.rotation.x = THREE.MathUtils.lerp(torso.rotation.x, 0.06, 0.15);
      } else {
        idlePhaseRef.current += delta * 2;
        const breathe = Math.sin(idlePhaseRef.current) * 0.02;
        torso.position.y = HIP_STAND + breathe;
        torso.position.z = THREE.MathUtils.lerp(torso.position.z, 0, 0.15);
        lLeg.rotation.x = THREE.MathUtils.lerp(lLeg.rotation.x, 0, 0.15);
        rLeg.rotation.x = THREE.MathUtils.lerp(rLeg.rotation.x, 0, 0.15);
        lArm.rotation.x = THREE.MathUtils.lerp(lArm.rotation.x, 0.05, 0.15);
        rArm.rotation.x = THREE.MathUtils.lerp(rArm.rotation.x, -0.05, 0.15);
        torso.rotation.x = THREE.MathUtils.lerp(torso.rotation.x, 0, 0.15);
      }
    });

    const limbMat = { roughness: 0.85, metalness: 0 };

    return (
      <group>
        {/* Torso pivot — hip height; legs are children so they stay attached */}
        <group ref={torsoRef} position={[0, HIP_STAND, 0]}>
          {/* Torso */}
          <mesh castShadow position={[0, 0.36, 0]}>
            <boxGeometry args={[0.62, 0.72, 0.34]} />
            <meshStandardMaterial color={config.shirt} {...limbMat} />
          </mesh>

          {/* Head */}
          <group position={[0, 0.88, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.52, 0.52, 0.52]} />
              <meshStandardMaterial color={config.skin} {...limbMat} />
            </mesh>
            <BlockyHair style={config.hairStyle} color={config.hairColor} />
            <group position={[0, 0, 0]}>
              <BlockyFace style={config.faceStyle} />
            </group>
          </group>

          {/* Left arm — shoulder pivot */}
          <group ref={leftArmRef} position={[-0.42, 0.48, 0]}>
            <mesh castShadow position={[0, -0.28, 0]}>
              <boxGeometry args={[0.26, 0.58, 0.26]} />
              <meshStandardMaterial color={config.shirt} {...limbMat} />
            </mesh>
            <mesh castShadow position={[0, -0.58, 0]}>
              <boxGeometry args={[0.24, 0.24, 0.24]} />
              <meshStandardMaterial color={config.skin} {...limbMat} />
            </mesh>
          </group>

          {/* Right arm */}
          <group ref={rightArmRef} position={[0.42, 0.48, 0]}>
            <mesh castShadow position={[0, -0.28, 0]}>
              <boxGeometry args={[0.26, 0.58, 0.26]} />
              <meshStandardMaterial color={config.shirt} {...limbMat} />
            </mesh>
            <mesh castShadow position={[0, -0.58, 0]}>
              <boxGeometry args={[0.24, 0.24, 0.24]} />
              <meshStandardMaterial color={config.skin} {...limbMat} />
            </mesh>
          </group>

          {/* Left leg — hip pivot at pelvis */}
          <group ref={leftLegRef} position={[-0.17, 0, 0]}>
            <mesh castShadow position={[0, -0.31, 0]}>
              <boxGeometry args={[0.28, 0.62, 0.28]} />
              <meshStandardMaterial color={config.pants} {...limbMat} />
            </mesh>
            <mesh castShadow position={[0, -0.66, 0.04]}>
              <boxGeometry args={[0.3, 0.18, 0.36]} />
              <meshStandardMaterial color="#222" roughness={0.9} />
            </mesh>
          </group>

          {/* Right leg */}
          <group ref={rightLegRef} position={[0.17, 0, 0]}>
            <mesh castShadow position={[0, -0.31, 0]}>
              <boxGeometry args={[0.28, 0.62, 0.28]} />
              <meshStandardMaterial color={config.pants} {...limbMat} />
            </mesh>
            <mesh castShadow position={[0, -0.66, 0.04]}>
              <boxGeometry args={[0.3, 0.18, 0.36]} />
              <meshStandardMaterial color="#222" roughness={0.9} />
            </mesh>
          </group>
        </group>
      </group>
    );
  },
);
