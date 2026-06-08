"use client";

import { useRef } from "react";
import * as THREE from "three";
import { TABLE_CENTERS } from "@/lib/library/seats";

/** A single bookshelf unit along a wall. */
function Bookshelf({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Main frame */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2, 3.5, 0.4]} />
        <meshStandardMaterial color="#5c3d1e" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Shelves */}
      {[-1.2, -0.3, 0.6, 1.5].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} castShadow>
          <boxGeometry args={[1.9, 0.06, 0.38]} />
          <meshStandardMaterial color="#7a5230" roughness={0.9} />
        </mesh>
      ))}
      {/* Books — random colors */}
      {[-1.1, -0.2, 0.7, 1.6].map((shelfY, si) =>
        Array.from({ length: 7 }).map((_, bi) => {
          const bookColors = ["#c0392b","#2980b9","#27ae60","#8e44ad","#d35400","#16a085","#2c3e50"];
          const w = 0.15 + (bi % 3) * 0.04;
          const h = 0.28 + (bi % 2) * 0.08;
          return (
            <mesh key={`${si}-${bi}`} position={[-0.8 + bi * 0.24, shelfY + h / 2 + 0.03, 0]} castShadow>
              <boxGeometry args={[w, h, 0.25]} />
              <meshStandardMaterial color={bookColors[(si * 7 + bi) % bookColors.length]} roughness={0.8} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

/** A study table. */
function StudyTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Tabletop */}
      <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
        <boxGeometry args={[3.2, 0.08, 1.4]} />
        <meshStandardMaterial color="#8B6914" roughness={0.6} metalness={0.05} />
      </mesh>
      {/* Legs */}
      {([-1.4, 1.4] as number[]).flatMap((x) =>
        ([-0.55, 0.55] as number[]).map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.375, z]} castShadow>
            <boxGeometry args={[0.08, 0.75, 0.08]} />
            <meshStandardMaterial color="#6b4f13" roughness={0.8} />
          </mesh>
        )),
      )}
      {/* Study lamp */}
      <mesh position={[1.2, 0.79, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.4, 8]} />
        <meshStandardMaterial color="#444" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[1.2, 1.05, 0.12]} castShadow>
        <coneGeometry args={[0.14, 0.18, 8, 1, true]} />
        <meshStandardMaterial color="#e8d5a0" side={THREE.DoubleSide} />
      </mesh>
      {/* Lamp point light */}
      <pointLight position={[1.2, 0.95, 0.12]} intensity={0.6} distance={3} color="#fff5cc" />
    </group>
  );
}

/** Study chair / stool at a seat. */
export function StudyChair({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation + Math.PI, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.45, 0.4]}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color="#2d2d2d" roughness={0.85} />
      </mesh>
      {([-0.2, 0.2] as number[]).flatMap((x) =>
        ([-0.2, 0.2] as number[]).map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.225, z + 0.4]} castShadow>
            <boxGeometry args={[0.05, 0.45, 0.05]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function LibraryEnvironment() {
  const floorRef = useRef<THREE.Mesh>(null);

  return (
    <group>
      {/* === LIGHTING === */}
      <hemisphereLight args={["#fff8ee", "#3d2b1a", 0.55]} />
      <ambientLight intensity={0.35} color="#f0e8d8" />
      <directionalLight
        position={[4, 10, 4]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        color="#ffe8c8"
      />
      {/* === FLOOR === */}
      <mesh
        ref={floorRef}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        position={[1, 0, 0]}
      >
        <planeGeometry args={[30, 20]} />
        <meshStandardMaterial color="#b8976a" roughness={0.75} metalness={0.02} />
      </mesh>

      {/* Floor plank seams */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          position={[1, 0.002, -9.5 + i]}
        >
          <planeGeometry args={[30, 0.015]} />
          <meshStandardMaterial color="#9a7d55" roughness={0.8} />
        </mesh>
      ))}

      {/* === WALLS === */}
      {/* Wainscoting panels on back wall */}
      {[-10, -7, -4, -1, 2, 5, 8, 11].map((x) => (
        <mesh key={`panel-${x}`} position={[x, 1.2, -9.88]} receiveShadow>
          <boxGeometry args={[2.6, 2.2, 0.04]} />
          <meshStandardMaterial color="#c9b896" roughness={0.85} />
        </mesh>
      ))}

      {/* Back wall */}
      <mesh position={[1, 2.5, -10]} receiveShadow>
        <boxGeometry args={[30, 5, 0.2]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.9} />
      </mesh>
      {/* Front partial wall (behind camera) */}
      <mesh position={[1, 2.5, 10]} receiveShadow>
        <boxGeometry args={[30, 5, 0.2]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.9} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-14, 2.5, 0]} receiveShadow>
        <boxGeometry args={[0.2, 5, 20]} />
        <meshStandardMaterial color="#cdbfa0" roughness={0.9} />
      </mesh>
      {/* Right wall */}
      <mesh position={[16, 2.5, 0]} receiveShadow>
        <boxGeometry args={[0.2, 5, 20]} />
        <meshStandardMaterial color="#cdbfa0" roughness={0.9} />
      </mesh>
      {/* === CROWN MOLDING === */}
      <mesh position={[1, 4.9, -9.9]}>
        <boxGeometry args={[30, 0.2, 0.2]} />
        <meshStandardMaterial color="#d8ccb8" roughness={0.9} />
      </mesh>

      {/* === BOOKSHELVES along back wall === */}
      {[-10, -7, -4, 5, 8, 11].map((x) => (
        <Bookshelf key={x} position={[x, 1.75, -9.7]} />
      ))}

      {/* === STUDY TABLES === */}
      {TABLE_CENTERS.map((pos, i) => (
        <StudyTable key={i} position={pos} />
      ))}

      {/* === DECORATIVE ELEMENTS === */}
      {/* Central study rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1, 0.003, 0]}>
        <planeGeometry args={[18, 8]} />
        <meshStandardMaterial color="#6b3f2e" roughness={0.95} />
      </mesh>
      {/* Rug inner pattern */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1, 0.004, 0]}>
        <planeGeometry args={[14, 5.5]} />
        <meshStandardMaterial color="#8b5540" roughness={0.92} />
      </mesh>

      {/* Entrance mat near spawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-11, 0.003, 6]}>
        <planeGeometry args={[3, 2.5]} />
        <meshStandardMaterial color="#4a6741" roughness={0.95} />
      </mesh>

      {/* Corner plants */}
      {([-12, 14] as number[]).flatMap((x) =>
        ([-7, 7] as number[]).map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <mesh castShadow position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.2, 0.25, 0.6, 8]} />
              <meshStandardMaterial color="#8B6914" roughness={0.9} />
            </mesh>
            <mesh castShadow position={[0, 0.8, 0]}>
              <sphereGeometry args={[0.5, 8, 8]} />
              <meshStandardMaterial color="#2d5a1b" roughness={0.95} />
            </mesh>
          </group>
        )),
      )}

      {/* Clock on back wall */}
      <group position={[1, 4.2, -9.8]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.08, 32]} />
          <meshStandardMaterial color="#3d2b1a" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <circleGeometry args={[0.45, 32]} />
          <meshStandardMaterial color="#f5f0e8" />
        </mesh>
      </group>

      {/* Windows on left wall — light shafts (spotLight instead of rectAreaLight
          to avoid needing RectAreaLightUniformsLib.init() which would otherwise
          cause a "Cannot read properties of undefined (reading 'd')" crash) */}
      {[-3, 3].map((z) => (
        <group key={z}>
          <mesh position={[-13.8, 3, z]}>
            <boxGeometry args={[0.05, 1.8, 1.2]} />
            <meshStandardMaterial color="#cce8ff" transparent opacity={0.6} />
          </mesh>
          <pointLight
            position={[-11, 3, z]}
            intensity={6}
            color="#d4eeff"
            distance={20}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
}
