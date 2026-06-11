"use client";

import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import type { LibraryLayout } from "@/lib/library/seats";

function Bookshelf({ position, rotY = 0 }: { position: [number, number, number]; rotY?: number }) {
  const bookColors = ["#c0392b", "#2980b9", "#27ae60", "#8e44ad", "#d35400", "#16a085", "#2c3e50", "#e67e22"];
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh>
        <boxGeometry args={[2, 3.5, 0.4]} />
        <meshStandardMaterial color="#5c3d1e" roughness={0.9} metalness={0.05} />
      </mesh>
      {[-1.2, -0.3, 0.6, 1.5].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[1.9, 0.06, 0.38]} />
          <meshStandardMaterial color="#7a5230" roughness={0.9} />
        </mesh>
      ))}
      {[-1.1, -0.2, 0.7, 1.6].map((shelfY, si) =>
        Array.from({ length: 7 }).map((_, bi) => {
          const w = 0.15 + (bi % 3) * 0.04;
          const h = 0.28 + (bi % 2) * 0.08;
          return (
            <mesh key={`${si}-${bi}`} position={[-0.8 + bi * 0.24, shelfY + h / 2 + 0.03, 0]}>
              <boxGeometry args={[w, h, 0.25]} />
              <meshStandardMaterial color={bookColors[(si * 7 + bi) % bookColors.length]} roughness={0.8} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

function StudyTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[4, 0.08, 1.4]} />
        <meshStandardMaterial color="#8B6914" roughness={0.6} metalness={0.05} />
      </mesh>
      {([-1.8, 1.8] as number[]).flatMap((x) =>
        ([-0.55, 0.55] as number[]).map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.375, z]}>
            <boxGeometry args={[0.09, 0.75, 0.09]} />
            <meshStandardMaterial color="#6b4f13" roughness={0.8} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.79, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.4, 8]} />
        <meshStandardMaterial color="#444" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.05, 0.12]}>
        <coneGeometry args={[0.14, 0.18, 8, 1, true]} />
        <meshStandardMaterial color="#e8d5a0" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function StudyChair({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation + Math.PI, 0]}>
      <mesh position={[0, 0.45, 0.4]}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color="#2d2d2d" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.22, 0.4]}>
        <boxGeometry args={[0.38, 0.44, 0.38]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
    </group>
  );
}

function LogoSign({ backZ, centerX }: { backZ: number; centerX: number }) {
  const logoTex = useTexture("/studytime-logo.png");
  const z = backZ + 0.15;
  return (
    <group>
      <mesh position={[centerX, 3.8, z]}>
        <boxGeometry args={[6.6, 6.6, 0.18]} />
        <meshStandardMaterial color="#3d2b1a" roughness={0.7} />
      </mesh>
      <mesh position={[centerX, 3.8, z + 0.1]}>
        <planeGeometry args={[5.6, 5.6]} />
        <meshBasicMaterial map={logoTex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function spreadAlong(start: number, end: number, count: number): number[] {
  if (count <= 1) return [(start + end) / 2];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * step);
}

type LibraryEnvironmentProps = {
  layout: LibraryLayout;
};

export function LibraryEnvironment({ layout }: LibraryEnvironmentProps) {
  const { bounds: b, tableCenters, isCompact, spawn } = layout;

  const decor = useMemo(() => {
    const innerLeft = b.wallLeftX + 2.5;
    const innerRight = b.wallRightX - 2.5;
    const backShelfZ = b.wallBackZ + 0.3;
    const backShelfCount = isCompact
      ? Math.min(4, Math.max(2, tableCenters.length))
      : 6;
    const backShelfXs = spreadAlong(innerLeft, innerRight, backShelfCount);

    const columnXs = [...new Set(tableCenters.map((t) => t[0]))];
    const rugDepth = Math.max(8, b.depth * 0.82);

    const sideShelfZs = isCompact
      ? spreadAlong(b.minZ, b.maxZ, Math.min(3, tableCenters.length))
      : [-18, -9, 0, 9];

    const windowZs = isCompact
      ? spreadAlong(b.minZ + 1, b.maxZ - 1, Math.min(3, Math.max(2, Math.ceil(tableCenters.length / 2))))
      : [-16, -6, 4, 14];

    const plantCorners: [number, number][] = [
      [b.wallLeftX + 1.5, b.wallBackZ + 2],
      [b.wallRightX - 1.5, b.wallBackZ + 2],
      [b.wallLeftX + 1.5, b.wallFrontZ - 2],
      [b.wallRightX - 1.5, b.wallFrontZ - 2],
    ];

    const wainscotXs = spreadAlong(innerLeft, innerRight, isCompact ? 3 : 6);

    return {
      backShelfXs,
      backShelfZ,
      columnXs,
      rugDepth,
      sideShelfZs,
      windowZs,
      plantCorners,
      wainscotXs,
    };
  }, [b, isCompact, tableCenters]);

  const plankCount = Math.max(8, Math.round(b.depth));

  return (
    <group>
      <hemisphereLight args={["#fff8ee", "#3d2b1a", 0.55]} />
      <ambientLight intensity={0.4} color="#f0e8d8" />
      <directionalLight
        position={[b.centerX, 14, b.centerZ + 6]}
        intensity={1.1}
        color="#ffe8c8"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={b.wallLeftX}
        shadow-camera-right={b.wallRightX}
        shadow-camera-top={b.wallFrontZ}
        shadow-camera-bottom={b.wallBackZ}
      />

      {tableCenters.map((pos) => (
        <pointLight
          key={`ceil-${pos[0]}-${pos[2]}`}
          position={[pos[0], 5.5, pos[2]]}
          intensity={isCompact ? 18 : 22}
          color="#fff5e0"
          distance={isCompact ? 18 : 24}
          decay={2}
        />
      ))}

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[b.centerX, 0, b.centerZ]}>
        <planeGeometry args={[b.width, b.depth]} />
        <meshStandardMaterial color="#b8976a" roughness={0.75} metalness={0.02} />
      </mesh>
      {Array.from({ length: plankCount }).map((_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[b.centerX, 0.002, b.wallBackZ + (i + 0.5) * (b.depth / plankCount)]}
        >
          <planeGeometry args={[b.width, 0.015]} />
          <meshStandardMaterial color="#9a7d55" roughness={0.8} />
        </mesh>
      ))}

      {/* Walls */}
      <mesh position={[b.centerX, 3, b.wallBackZ]}>
        <boxGeometry args={[b.width, 6, 0.2]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.9} />
      </mesh>
      <mesh position={[b.centerX, 3, b.wallFrontZ]}>
        <boxGeometry args={[b.width, 6, 0.2]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.9} />
      </mesh>
      <mesh position={[b.wallLeftX, 3, b.centerZ]}>
        <boxGeometry args={[0.2, 6, b.depth]} />
        <meshStandardMaterial color="#cdbfa0" roughness={0.9} />
      </mesh>
      <mesh position={[b.wallRightX, 3, b.centerZ]}>
        <boxGeometry args={[0.2, 6, b.depth]} />
        <meshStandardMaterial color="#cdbfa0" roughness={0.9} />
      </mesh>

      {decor.wainscotXs.map((x) => (
        <mesh key={`panel-${x}`} position={[x, 1.2, b.wallBackZ + 0.12]}>
          <boxGeometry args={[2.2, 2.2, 0.04]} />
          <meshStandardMaterial color="#c9b896" roughness={0.85} />
        </mesh>
      ))}

      <mesh position={[b.centerX, 5.9, b.wallBackZ + 0.1]}>
        <boxGeometry args={[b.width, 0.2, 0.2]} />
        <meshStandardMaterial color="#d8ccb8" roughness={0.9} />
      </mesh>
      <mesh position={[b.wallLeftX + 0.1, 5.9, b.centerZ]}>
        <boxGeometry args={[0.2, 0.2, b.depth]} />
        <meshStandardMaterial color="#d8ccb8" roughness={0.9} />
      </mesh>
      <mesh position={[b.wallRightX - 0.1, 5.9, b.centerZ]}>
        <boxGeometry args={[0.2, 0.2, b.depth]} />
        <meshStandardMaterial color="#d8ccb8" roughness={0.9} />
      </mesh>

      {/* Bookshelves */}
      {decor.backShelfXs.map((x) => (
        <Bookshelf key={`back-${x}`} position={[x, 1.75, decor.backShelfZ]} />
      ))}
      {(!isCompact || b.width >= 20) &&
        decor.sideShelfZs.map((z) => (
          <Bookshelf
            key={`left-${z}`}
            position={[b.wallLeftX + 0.4, 1.75, z]}
            rotY={Math.PI / 2}
          />
        ))}
      {(!isCompact || b.width >= 20) &&
        decor.sideShelfZs.map((z) => (
          <Bookshelf
            key={`right-${z}`}
            position={[b.wallRightX - 0.4, 1.75, z]}
            rotY={-Math.PI / 2}
          />
        ))}

      {tableCenters.map((pos, i) => (
        <StudyTable key={`table-${i}`} position={pos} />
      ))}

      {decor.columnXs.map((cx) => (
        <group key={`rug-${cx}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.003, b.centerZ]}>
            <planeGeometry args={[8, decor.rugDepth]} />
            <meshStandardMaterial color="#6b3f2e" roughness={0.95} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.004, b.centerZ]}>
            <planeGeometry args={[5.5, decor.rugDepth * 0.9]} />
            <meshStandardMaterial color="#8b5540" roughness={0.92} />
          </mesh>
        </group>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[spawn[0], 0.003, spawn[2]]}>
        <planeGeometry args={[3, 4]} />
        <meshStandardMaterial color="#4a6741" roughness={0.95} />
      </mesh>

      {decor.plantCorners.map(([x, z]) => (
        <group key={`plant-${x}-${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.22, 0.28, 0.65, 8]} />
            <meshStandardMaterial color="#8B6914" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.85, 0]}>
            <sphereGeometry args={[0.55, 8, 8]} />
            <meshStandardMaterial color="#2d5a1b" roughness={0.95} />
          </mesh>
        </group>
      ))}

      <group position={[b.centerX + Math.min(4, b.width * 0.22), 5.2, b.wallBackZ + 0.2]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.08, 32]} />
          <meshStandardMaterial color="#3d2b1a" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <circleGeometry args={[0.45, 32]} />
          <meshStandardMaterial color="#f5f0e8" />
        </mesh>
      </group>

      {decor.windowZs.map((z) => (
        <group key={`lwin-${z}`}>
          <mesh position={[b.wallLeftX - 0.2, 3.2, z]}>
            <boxGeometry args={[0.05, 2.0, 1.4]} />
            <meshStandardMaterial color="#cce8ff" transparent opacity={0.6} />
          </mesh>
          <pointLight
            position={[b.wallLeftX + 1.5, 3.2, z]}
            intensity={8}
            color="#d4eeff"
            distance={18}
            decay={2}
          />
        </group>
      ))}

      {decor.windowZs.map((z) => (
        <group key={`rwin-${z}`}>
          <mesh position={[b.wallRightX + 0.2, 3.2, z]}>
            <boxGeometry args={[0.05, 2.0, 1.4]} />
            <meshStandardMaterial color="#ffe8cc" transparent opacity={0.55} />
          </mesh>
          <pointLight
            position={[b.wallRightX - 1.5, 3.2, z]}
            intensity={6}
            color="#ffe8cc"
            distance={16}
            decay={2}
          />
        </group>
      ))}

      <Suspense fallback={null}>
        <LogoSign backZ={b.wallBackZ} centerX={b.centerX} />
      </Suspense>
    </group>
  );
}
