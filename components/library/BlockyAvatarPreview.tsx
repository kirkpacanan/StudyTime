"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { useTheme } from "@/contexts/theme-context";
import { BlockyAvatarMesh } from "./BlockyAvatarMesh";
import type { BlockyAvatarConfig } from "@/lib/library/blocky-avatar";

type BlockyAvatarPreviewProps = {
  config: BlockyAvatarConfig;
  animState?: "idle" | "walk" | "sit";
  className?: string;
  /** Match parent shell — lighter canvas in app light mode. */
  variant?: "app" | "library";
};

const LIBRARY_CANVAS_BG = "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)";
const APP_CANVAS_BG = {
  light: "linear-gradient(180deg, #e2e8f4 0%, #cbd5e1 100%)",
  dark: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
} as const;

const FLOOR_COLOR = {
  library: "#334155",
  app: { light: "#94a3b8", dark: "#334155" },
} as const;

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
  variant = "library",
}: BlockyAvatarPreviewProps) {
  const { theme } = useTheme();
  const canvasBg =
    variant === "library"
      ? LIBRARY_CANVAS_BG
      : APP_CANVAS_BG[theme];
  const floorColor =
    variant === "library"
      ? FLOOR_COLOR.library
      : FLOOR_COLOR.app[theme];

  return (
    <div className={className ?? "h-full w-full"}>
      <Canvas shadows style={{ background: canvasBg }}>
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
          <meshStandardMaterial color={floorColor} />
        </mesh>
        <group position={[0, 0, 0]}>
          <BlockyAvatarMesh config={config} animState={animState} />
        </group>
        <PortraitControls animState={animState} />
      </Canvas>
    </div>
  );
}
