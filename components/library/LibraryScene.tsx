"use client";

import { Suspense, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { LibraryEnvironment, StudyChair } from "./LibraryEnvironment";
import { SeatMarker } from "./SeatMarker";
import { Avatar } from "./Avatar";
import { OtherUserAvatar } from "./OtherUserAvatar";
import { LIBRARY_SEATS } from "@/lib/library/seats";
import type { LibraryFlowState, LibraryPeer } from "@/hooks/useLibraryPresence";
import * as THREE from "three";

type LibrarySceneProps = {
  flowState: LibraryFlowState;
  myAvatarUrl: string | null;
  mySeatId: string | null;
  myStatus: "idle" | "studying" | "break" | "completed";
  myFocusScore: number;
  peers: Map<string, LibraryPeer>;
  onSeatClick: (seatId: string) => void;
  userName: string;
};

function FallbackAvatar({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.25, 0.8, 8, 16]} />
        <meshStandardMaterial color="#6366f1" roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 1.85, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#f4c99e" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function LibraryScene({
  flowState,
  myAvatarUrl,
  mySeatId,
  myStatus,
  myFocusScore,
  peers,
  onSeatClick,
  userName,
}: LibrarySceneProps) {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);

  const occupiedSeatIds = new Set<string>(
    [...peers.values()].map((p) => p.seatId).filter(Boolean) as string[],
  );
  if (mySeatId) occupiedSeatIds.add(mySeatId);

  const mySeat = LIBRARY_SEATS.find((s) => s.id === mySeatId);

  const handleSeatClick = useCallback(
    (seatId: string) => {
      if (flowState === "seat_select" || flowState === "duration_select") {
        onSeatClick(seatId);
      }
    },
    [flowState, onSeatClick],
  );

  return (
    <Canvas
      shadows
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      style={{ width: "100%", height: "100%", background: "#1a1206" }}
    >
      <PerspectiveCamera makeDefault position={[1, 8, 14]} fov={55} near={0.1} far={200} />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={8}
        maxDistance={22}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        target={[1, 0.5, 0]}
      />

      <Suspense fallback={null}>
        <LibraryEnvironment />

        {/* Seat markers + chairs */}
        {LIBRARY_SEATS.map((seat) => {
          const isOccupied = occupiedSeatIds.has(seat.id);
          const isMySeat = seat.id === mySeatId;
          return (
            <group key={seat.id}>
              <StudyChair position={seat.position} rotation={seat.rotation} />
              {!isMySeat && (
                <SeatMarker
                  seat={seat}
                  occupied={isOccupied}
                  selectable={flowState === "seat_select" || flowState === "duration_select"}
                  onClick={() => handleSeatClick(seat.id)}
                />
              )}
            </group>
          );
        })}

        {/* Local user avatar */}
        {mySeat && (
          myAvatarUrl ? (
            <Avatar
              avatarUrl={myAvatarUrl}
              targetPosition={mySeat.position}
              targetRotation={mySeat.rotation}
              status={myStatus}
              focusScore={myFocusScore}
              displayName={userName}
              isLocalUser
            />
          ) : (
            <group>
              <FallbackAvatar position={mySeat.position} />
            </group>
          )
        )}

        {/* Peer avatars */}
        {[...peers.values()].map((peer) => {
          const peerSeat = peer.seatId
            ? LIBRARY_SEATS.find((s) => s.id === peer.seatId)
            : null;
          if (!peerSeat) return null;
          return (
            <OtherUserAvatar
              key={peer.userId}
              peer={peer}
              seatPosition={peerSeat.position}
              seatRotation={peerSeat.rotation}
            />
          );
        })}
      </Suspense>
    </Canvas>
  );
}
