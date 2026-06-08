"use client";

import type { FaceStyle, HairStyle } from "@/lib/library/blocky-avatar";

const mat = { roughness: 0.85, metalness: 0 };

/** Blocky hair variants sitting on top of the head. */
export function BlockyHair({ style, color }: { style: HairStyle; color: string }) {
  if (style === "none") return null;

  if (style === "classic") {
    return (
      <mesh castShadow position={[0, 0.38, 0]}>
        <boxGeometry args={[0.56, 0.18, 0.56]} />
        <meshStandardMaterial color={color} {...mat} />
      </mesh>
    );
  }

  if (style === "spiky") {
    return (
      <group>
        {[
          [0, 0.42, 0, 0.14, 0.22, 0.14],
          [-0.14, 0.36, 0.08, 0.1, 0.16, 0.1],
          [0.14, 0.36, -0.08, 0.1, 0.16, 0.1],
          [0.08, 0.34, 0.14, 0.1, 0.14, 0.1],
          [-0.08, 0.34, -0.14, 0.1, 0.14, 0.1],
        ].map(([x, y, z, w, h, d], i) => (
          <mesh key={i} castShadow position={[x, y, z]}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={color} {...mat} />
          </mesh>
        ))}
      </group>
    );
  }

  if (style === "long") {
    return (
      <group>
        <mesh castShadow position={[0, 0.34, 0]}>
          <boxGeometry args={[0.56, 0.14, 0.56]} />
          <meshStandardMaterial color={color} {...mat} />
        </mesh>
        <mesh castShadow position={[-0.3, 0.05, 0]}>
          <boxGeometry args={[0.12, 0.42, 0.48]} />
          <meshStandardMaterial color={color} {...mat} />
        </mesh>
        <mesh castShadow position={[0.3, 0.05, 0]}>
          <boxGeometry args={[0.12, 0.42, 0.48]} />
          <meshStandardMaterial color={color} {...mat} />
        </mesh>
      </group>
    );
  }

  if (style === "afro") {
    return (
      <mesh castShadow position={[0, 0.42, 0]}>
        <boxGeometry args={[0.62, 0.38, 0.62]} />
        <meshStandardMaterial color={color} {...mat} />
      </mesh>
    );
  }

  // mohawk
  return (
    <mesh castShadow position={[0, 0.48, 0]}>
      <boxGeometry args={[0.14, 0.32, 0.48]} />
      <meshStandardMaterial color={color} {...mat} />
    </mesh>
  );
}

function Eye({ x, y, size = 0.07 }: { x: number; y: number; size?: number }) {
  return (
    <mesh position={[x, y, 0.02]}>
      <boxGeometry args={[size, size, 0.02]} />
      <meshStandardMaterial color="#111" roughness={1} />
    </mesh>
  );
}

/** Blocky face decals on the front of the head. */
export function BlockyFace({ style }: { style: FaceStyle }) {
  const z = 0.27;

  if (style === "classic") {
    return (
      <mesh position={[0, 0, z]}>
        <boxGeometry args={[0.36, 0.12, 0.04]} />
        <meshStandardMaterial color="#111" roughness={1} />
      </mesh>
    );
  }

  if (style === "cool") {
    return (
      <group position={[0, 0, z]}>
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.4, 0.1, 0.04]} />
          <meshStandardMaterial color="#111" roughness={0.6} metalness={0.2} />
        </mesh>
        <mesh position={[0, -0.1, 0]}>
          <boxGeometry args={[0.14, 0.03, 0.02]} />
          <meshStandardMaterial color="#111" roughness={1} />
        </mesh>
      </group>
    );
  }

  if (style === "sleepy") {
    return (
      <group position={[0, 0, z]}>
        <mesh position={[-0.1, 0.06, 0]}>
          <boxGeometry args={[0.1, 0.03, 0.02]} />
          <meshStandardMaterial color="#111" roughness={1} />
        </mesh>
        <mesh position={[0.1, 0.06, 0]}>
          <boxGeometry args={[0.1, 0.03, 0.02]} />
          <meshStandardMaterial color="#111" roughness={1} />
        </mesh>
        <mesh position={[0, -0.08, 0]}>
          <boxGeometry args={[0.08, 0.03, 0.02]} />
          <meshStandardMaterial color="#111" roughness={1} />
        </mesh>
      </group>
    );
  }

  if (style === "surprised") {
    return (
      <group position={[0, 0, z]}>
        <Eye x={-0.1} y={0.06} size={0.09} />
        <Eye x={0.1} y={0.06} size={0.09} />
        <mesh position={[0, -0.1, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.02]} />
          <meshStandardMaterial color="#111" roughness={1} />
        </mesh>
      </group>
    );
  }

  // smile & happy
  const eyeSize = style === "happy" ? 0.08 : 0.07;
  return (
    <group position={[0, 0, z]}>
      <Eye x={-0.1} y={0.05} size={eyeSize} />
      <Eye x={0.1} y={0.05} size={eyeSize} />
      <mesh position={[0, -0.1, 0]} rotation={[0, 0, style === "happy" ? 0 : -0.1]}>
        <boxGeometry args={[0.16, 0.04, 0.02]} />
        <meshStandardMaterial color="#111" roughness={1} />
      </mesh>
      {style === "happy" && (
        <mesh position={[0, -0.06, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.02]} />
          <meshStandardMaterial color="#E8A090" roughness={1} />
        </mesh>
      )}
    </group>
  );
}
