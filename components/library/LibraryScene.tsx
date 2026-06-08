"use client";

import { Suspense, useCallback, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, ContactShadows } from "@react-three/drei";
import { LibraryEnvironment, StudyChair } from "./LibraryEnvironment";
import { SeatMarker } from "./SeatMarker";
import { BlockyAvatar } from "./BlockyAvatar";
import { OtherUserAvatar } from "./OtherUserAvatar";
import { AVATAR_SPAWN, LIBRARY_SEATS, getSeatAvatarPosition } from "@/lib/library/seats";
import {
  blockyAvatarFromSeed,
  parseBlockyAvatar,
} from "@/lib/library/blocky-avatar";
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
  userId: string;
};

export function LibraryScene({
  flowState,
  myAvatarUrl,
  mySeatId,
  myStatus,
  myFocusScore,
  peers,
  onSeatClick,
  userName,
  userId,
}: LibrarySceneProps) {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);

  const occupiedSeatIds = new Set<string>(
    [...peers.values()].map((p) => p.seatId).filter(Boolean) as string[],
  );
  if (mySeatId) occupiedSeatIds.add(mySeatId);

  const mySeat = LIBRARY_SEATS.find((s) => s.id === mySeatId);
  const avatarTarget = mySeat ? getSeatAvatarPosition(mySeat) : AVATAR_SPAWN;
  const avatarRotation = mySeat?.rotation ?? Math.PI / 2;

  const myBlockyConfig = useMemo(
    () => parseBlockyAvatar(myAvatarUrl) ?? blockyAvatarFromSeed(userId),
    [myAvatarUrl, userId],
  );

  const handleSeatClick = useCallback(
    (seatId: string) => {
      if (flowState === "seat_select") onSeatClick(seatId);
    },
    [flowState, onSeatClick],
  );

  const showStatusBadge =
    flowState === "studying" || flowState === "session_end";

  const renderLocalAvatar = flowState !== "entering";

  return (
    <Canvas
      shadows
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      style={{ width: "100%", height: "100%", background: "#1a1206" }}
    >
      <color attach="background" args={["#1a1206"]} />
      <fog attach="fog" args={["#1a1206", 18, 45]} />

      <PerspectiveCamera makeDefault position={[1, 12, 9]} fov={58} near={0.1} far={80} />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={8}
        maxDistance={24}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI / 2.15}
        target={[1, 0.3, 0]}
      />

      <Suspense fallback={null}>
        <LibraryEnvironment />

        <ContactShadows
          position={[1, 0.01, 0]}
          opacity={0.45}
          scale={28}
          blur={2.5}
          far={6}
          color="#3d2b1a"
        />

        {LIBRARY_SEATS.map((seat) => {
          const isOccupied = occupiedSeatIds.has(seat.id);
          const isMySeat = seat.id === mySeatId;
          return (
            <group key={seat.id}>
              <StudyChair position={seat.position} rotation={seat.rotation} />
              {!isMySeat && flowState === "seat_select" && (
                <SeatMarker
                  seat={seat}
                  occupied={isOccupied}
                  selectable={!isOccupied}
                  onClick={() => handleSeatClick(seat.id)}
                />
              )}
            </group>
          );
        })}

        {renderLocalAvatar && (
          <BlockyAvatar
            config={myBlockyConfig}
            spawnPosition={AVATAR_SPAWN}
            targetPosition={avatarTarget}
            targetRotation={avatarRotation}
            status={myStatus}
            focusScore={myFocusScore}
            displayName={userName}
            showStatusBadge={showStatusBadge}
          />
        )}

        {[...peers.values()].map((peer) => {
          const peerSeat = peer.seatId
            ? LIBRARY_SEATS.find((s) => s.id === peer.seatId)
            : null;
          if (!peerSeat) return null;
          return (
            <OtherUserAvatar
              key={peer.userId}
              peer={peer}
              seatPosition={getSeatAvatarPosition(peerSeat)}
              seatRotation={peerSeat.rotation}
              showStatusBadge={showStatusBadge}
            />
          );
        })}
      </Suspense>
    </Canvas>
  );
}
