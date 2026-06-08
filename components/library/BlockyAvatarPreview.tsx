"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { BlockyAvatarMesh } from "./BlockyAvatarMesh";
import type { BlockyAvatarConfig } from "@/lib/library/blocky-avatar";

type BlockyAvatarPreviewProps = {
  config: BlockyAvatarConfig;
  animState?: "idle" | "walk" | "sit";
  className?: string;
};

function PortraitControls({ animState }: { animState: "idle" | "walk" | "sit" }) {
  const ref = useRef<React.ComponentRef<typeof OrbitControls>>(null);

  useFrame(() => {
    const controls = ref.current;
    if (!controls) return;
    const targetY = animState === "sit" ? 1.35 : 1.55;
    controls.target.lerp(new THREE.Vector3(0, targetY, 0), 0.1);
    controls.update();
  });

  return (
    <OrbitControls
      ref={ref}
      enablePan={false}
      enableZoom
      minDistance={2.2}
      maxDistance={3.8}
      target={[0, 1.48, 0]}
      minPolarAngle={Math.PI / 3.2}
      maxPolarAngle={Math.PI / 2.05}
      autoRotate
      autoRotateSpeed={0.8}
    />
  );
}

/** Live 3D preview for the avatar customizer — framed on face & hair. */
export function BlockyAvatarPreview({
  config,
  animState = "idle",
  className,
}: BlockyAvatarPreviewProps) {
  return (
    <div className={className ?? "h-full w-full"}>
      <Canvas
        shadows
        style={{ background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)" }}
      >
        <PerspectiveCamera
          makeDefault
          position={[0, 1.52, 2.7]}
          fov={30}
          near={0.1}
          far={20}
        />
        <ambientLight intensity={0.65} />
        <directionalLight position={[2, 4, 3]} intensity={1.2} castShadow />
        <directionalLight position={[-2, 2, 1]} intensity={0.35} color="#a5c4ff" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[4, 4]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <group position={[0, 0, 0]}>
          <BlockyAvatarMesh config={config} animState={animState} />
        </group>
        <PortraitControls animState={animState} />
      </Canvas>
    </div>
  );
}
