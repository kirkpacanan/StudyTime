"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { SeatPosition } from "@/lib/library/seats";

type SeatMarkerProps = {
  seat: SeatPosition;
  occupied: boolean;
  selectable: boolean;
  onClick: () => void;
};

export function SeatMarker({ seat, occupied, selectable, onClick }: SeatMarkerProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current || occupied) return;
    const t = state.clock.getElapsedTime();
    // Pulsing scale animation for empty selectable seats
    const pulse = 1 + Math.sin(t * 2.5) * 0.08;
    ringRef.current.scale.setScalar(pulse);
    if (glowRef.current) {
      const opacity = 0.25 + Math.sin(t * 2.5) * 0.12;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
  });

  const [x, , z] = seat.position;

  if (occupied) {
    return null;
  }

  return (
    <group position={[x, 0.01, z]}>
      {/* Outer glow ring */}
      <mesh
        ref={glowRef}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.45, 0.7, 32]} />
        <meshBasicMaterial
          color="#22c55e"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Main indicator ring */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={selectable ? onClick : undefined}
        onPointerOver={(e) => {
          if (!selectable) return;
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        <ringGeometry args={[0.32, 0.45, 32]} />
        <meshBasicMaterial
          color={selectable ? "#4ade80" : "#86efac"}
          transparent
          opacity={selectable ? 0.9 : 0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Center dot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.1, 16]} />
        <meshBasicMaterial color="#bbf7d0" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Tooltip label when selectable */}
      {selectable && (
        <Html
          center
          position={[0, 0.6, 0]}
          distanceFactor={10}
          occlude
        >
          <div
            className="pointer-events-none whitespace-nowrap rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg backdrop-blur-sm"
            style={{ userSelect: "none" }}
          >
            {seat.label} · Click to sit
          </div>
        </Html>
      )}
    </group>
  );
}
