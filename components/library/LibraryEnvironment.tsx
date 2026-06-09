"use client";

import { Suspense } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { TABLE_CENTERS } from "@/lib/library/seats";

// ---------------------------------------------------------------------------
// Bookshelf unit
// ---------------------------------------------------------------------------
function Bookshelf({ position, rotY = 0 }: { position: [number, number, number]; rotY?: number }) {
  const bookColors = ["#c0392b","#2980b9","#27ae60","#8e44ad","#d35400","#16a085","#2c3e50","#e67e22"];
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

// ---------------------------------------------------------------------------
// Study table — 4 units wide, seats up to 5 (3 on front side, 2 on back)
// ---------------------------------------------------------------------------
function StudyTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Tabletop */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[4, 0.08, 1.4]} />
        <meshStandardMaterial color="#8B6914" roughness={0.6} metalness={0.05} />
      </mesh>
      {/* 4 legs at corners */}
      {([-1.8, 1.8] as number[]).flatMap((x) =>
        ([-0.55, 0.55] as number[]).map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.375, z]}>
            <boxGeometry args={[0.09, 0.75, 0.09]} />
            <meshStandardMaterial color="#6b4f13" roughness={0.8} />
          </mesh>
        )),
      )}
      {/* Single desk lamp in the centre */}
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

// ---------------------------------------------------------------------------
// Study chair — 2-mesh design for performance
// ---------------------------------------------------------------------------
export function StudyChair({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation + Math.PI, 0]}>
      {/* Seat cushion */}
      <mesh position={[0, 0.45, 0.4]}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color="#2d2d2d" roughness={0.85} />
      </mesh>
      {/* Unified leg block */}
      <mesh position={[0, 0.22, 0.4]}>
        <boxGeometry args={[0.38, 0.44, 0.38]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// StudyTime logo sign on the back wall
// ---------------------------------------------------------------------------
function LogoSign() {
  const logoTex = useTexture("/studytime-logo.png");
  return (
    <group>
      {/* Dark wooden backing board */}
      <mesh position={[0, 3.8, -26.85]}>
        <boxGeometry args={[6.6, 6.6, 0.18]} />
        <meshStandardMaterial color="#3d2b1a" roughness={0.7} />
      </mesh>
      {/* Logo texture plane */}
      <mesh position={[0, 3.8, -26.75]}>
        <planeGeometry args={[5.6, 5.6]} />
        <meshBasicMaterial map={logoTex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Main environment — room: 36 × 54, walls at x = ±18, z = ±27
// ---------------------------------------------------------------------------
export function LibraryEnvironment() {
  return (
    <group>
      {/* ================================================================
          LIGHTING
          ================================================================ */}
      <hemisphereLight args={["#fff8ee", "#3d2b1a", 0.55]} />
      <ambientLight intensity={0.4} color="#f0e8d8" />
      <directionalLight
        position={[0, 14, 6]}
        intensity={1.1}
        color="#ffe8c8"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-19}
        shadow-camera-right={19}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
      />
      {/* 6 overhead ceiling lights — one above each column × 3 Z positions */}
      {([-7, 7] as number[]).flatMap((x) =>
        ([-15, 0, 15] as number[]).map((z) => (
          <pointLight
            key={`ceil-${x}-${z}`}
            position={[x, 5.5, z]}
            intensity={22}
            color="#fff5e0"
            distance={24}
            decay={2}
          />
        )),
      )}

      {/* ================================================================
          FLOOR  36 × 54
          Seats span x ∈ [-7, 7], z ∈ [-22.5, 22.5] — comfortable margin.
          ================================================================ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[36, 54]} />
        <meshStandardMaterial color="#b8976a" roughness={0.75} metalness={0.02} />
      </mesh>
      {/* Floor plank seams */}
      {Array.from({ length: 54 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, -26.5 + i]}>
          <planeGeometry args={[36, 0.015]} />
          <meshStandardMaterial color="#9a7d55" roughness={0.8} />
        </mesh>
      ))}

      {/* ================================================================
          WALLS  height 6
          ================================================================ */}
      {/* Back wall */}
      <mesh position={[0, 3, -27]}>
        <boxGeometry args={[36, 6, 0.2]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.9} />
      </mesh>
      {/* Front wall */}
      <mesh position={[0, 3, 27]}>
        <boxGeometry args={[36, 6, 0.2]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.9} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-18, 3, 0]}>
        <boxGeometry args={[0.2, 6, 54]} />
        <meshStandardMaterial color="#cdbfa0" roughness={0.9} />
      </mesh>
      {/* Right wall */}
      <mesh position={[18, 3, 0]}>
        <boxGeometry args={[0.2, 6, 54]} />
        <meshStandardMaterial color="#cdbfa0" roughness={0.9} />
      </mesh>

      {/* Wainscoting panels on back wall — flanking the logo gap */}
      {[-13, -10, -7, 7, 10, 13].map((x) => (
        <mesh key={`panel-${x}`} position={[x, 1.2, -26.88]}>
          <boxGeometry args={[2.6, 2.2, 0.04]} />
          <meshStandardMaterial color="#c9b896" roughness={0.85} />
        </mesh>
      ))}

      {/* Crown molding */}
      <mesh position={[0, 5.9, -26.9]}>
        <boxGeometry args={[36, 0.2, 0.2]} />
        <meshStandardMaterial color="#d8ccb8" roughness={0.9} />
      </mesh>
      <mesh position={[-17.9, 5.9, 0]}>
        <boxGeometry args={[0.2, 0.2, 54]} />
        <meshStandardMaterial color="#d8ccb8" roughness={0.9} />
      </mesh>
      <mesh position={[17.9, 5.9, 0]}>
        <boxGeometry args={[0.2, 0.2, 54]} />
        <meshStandardMaterial color="#d8ccb8" roughness={0.9} />
      </mesh>

      {/* ================================================================
          BOOKSHELVES
          Back wall: 6 units flanking the logo gap
          Left & right walls: 4 units each
          ================================================================ */}
      {[-13, -9, -5, 5, 9, 13].map((x) => (
        <Bookshelf key={`back-${x}`} position={[x, 1.75, -26.7]} />
      ))}
      {[-18, -9, 0, 9].map((z) => (
        <Bookshelf key={`left-${z}`} position={[-17.6, 1.75, z]} rotY={Math.PI / 2} />
      ))}
      {[-18, -9, 0, 9].map((z) => (
        <Bookshelf key={`right-${z}`} position={[17.6, 1.75, z]} rotY={-Math.PI / 2} />
      ))}

      {/* ================================================================
          STUDY TABLES  (5 long tables, one per TABLE_CENTERS entry)
          ================================================================ */}
      {TABLE_CENTERS.map((pos, i) => (
        <StudyTable key={i} position={pos} />
      ))}

      {/* ================================================================
          DECORATIVE ELEMENTS
          ================================================================ */}
      {/* Rugs under each column of tables */}
      {[-7, 7].map((cx) => (
        <group key={`rug-${cx}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.003, 0]}>
            <planeGeometry args={[8, 44]} />
            <meshStandardMaterial color="#6b3f2e" roughness={0.95} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.004, 0]}>
            <planeGeometry args={[5.5, 40]} />
            <meshStandardMaterial color="#8b5540" roughness={0.92} />
          </mesh>
        </group>
      ))}

      {/* Entrance mat near spawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-17, 0.003, 0]}>
        <planeGeometry args={[3, 4]} />
        <meshStandardMaterial color="#4a6741" roughness={0.95} />
      </mesh>

      {/* Corner plants */}
      {([-16, 16] as number[]).flatMap((x) =>
        ([-23, 23] as number[]).map((z) => (
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
        )),
      )}

      {/* Clock on back wall (right of logo) */}
      <group position={[10, 5.2, -26.8]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.08, 32]} />
          <meshStandardMaterial color="#3d2b1a" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <circleGeometry args={[0.45, 32]} />
          <meshStandardMaterial color="#f5f0e8" />
        </mesh>
      </group>

      {/* Windows on left wall */}
      {[-16, -6, 4, 14].map((z) => (
        <group key={`lwin-${z}`}>
          <mesh position={[-17.8, 3.2, z]}>
            <boxGeometry args={[0.05, 2.0, 1.4]} />
            <meshStandardMaterial color="#cce8ff" transparent opacity={0.6} />
          </mesh>
          <pointLight position={[-15, 3.2, z]} intensity={9} color="#d4eeff" distance={22} decay={2} />
        </group>
      ))}

      {/* Windows on right wall */}
      {[-16, -6, 4, 14].map((z) => (
        <group key={`rwin-${z}`}>
          <mesh position={[17.8, 3.2, z]}>
            <boxGeometry args={[0.05, 2.0, 1.4]} />
            <meshStandardMaterial color="#ffe8cc" transparent opacity={0.55} />
          </mesh>
          <pointLight position={[15, 3.2, z]} intensity={7} color="#ffe8cc" distance={20} decay={2} />
        </group>
      ))}

      {/* ================================================================
          STUDYTIME LOGO SIGN
          ================================================================ */}
      <Suspense fallback={null}>
        <LogoSign />
      </Suspense>
    </group>
  );
}
