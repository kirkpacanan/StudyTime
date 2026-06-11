"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, ContactShadows } from "@react-three/drei";
import { LibraryEnvironment, StudyChair } from "./LibraryEnvironment";
import { SeatMarker } from "./SeatMarker";
import { BlockyAvatar } from "./BlockyAvatar";
import { OtherUserAvatar } from "./OtherUserAvatar";
import {
  LIBRARY_SEATS,
  getLibraryLayout,
  getSeatAvatarPosition,
  type SeatPosition,
} from "@/lib/library/seats";
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
  /** When set, only this many seats are available in the 3D library. */
  participantLimit?: number;
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
  participantLimit,
}: LibrarySceneProps) {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);

  const layout = useMemo(
    () => getLibraryLayout(participantLimit),
    [participantLimit],
  );
  const { seats, spawn, camera, fog, bounds } = layout;
  const activeSeatIds = useMemo(() => new Set(seats.map((s) => s.id)), [seats]);

  const occupiedSeatIds = new Set<string>(
    [...peers.values()].map((p) => p.seatId).filter(Boolean) as string[],
  );
  if (mySeatId) occupiedSeatIds.add(mySeatId);

  const findSeat = useCallback(
    (id: string | null): SeatPosition | undefined => {
      if (!id) return undefined;
      return seats.find((s) => s.id === id) ?? LIBRARY_SEATS.find((s) => s.id === id);
    },
    [seats],
  );

  const mySeat = findSeat(mySeatId);
  const avatarTarget = mySeat ? getSeatAvatarPosition(mySeat) : spawn;
  const avatarRotation = mySeat?.rotation ?? Math.PI / 2;

  const myBlockyConfig = useMemo(
    () => parseBlockyAvatar(myAvatarUrl) ?? blockyAvatarFromSeed(userId),
    [myAvatarUrl, userId],
  );

  const handleSeatClick = useCallback(
    (seatId: string) => {
      if (flowState !== "seat_select") return;
      if (!activeSeatIds.has(seatId)) return;
      onSeatClick(seatId);
    },
    [flowState, activeSeatIds, onSeatClick],
  );

  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    ctrl.target.set(camera.target[0], camera.target[1], camera.target[2]);
    ctrl.minDistance = camera.minDistance;
    ctrl.maxDistance = camera.maxDistance;
    ctrl.update();
  }, [camera]);

  const showStatusBadge =
    flowState === "studying" || flowState === "session_end";

  const renderLocalAvatar = flowState !== "entering";

  const shadowScale = Math.max(12, bounds.width * 0.65);

  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.5]}
      gl={{
        antialias: false,
        powerPreference: "low-power",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
      }}
      style={{ width: "100%", height: "100%", background: "#1a1206" }}
    >
      <color attach="background" args={["#1a1206"]} />
      <fog attach="fog" args={["#1a1206", fog.near, fog.far]} />

      <PerspectiveCamera
        makeDefault
        position={camera.position}
        fov={65}
        near={0.1}
        far={110}
      />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={camera.minDistance}
        maxDistance={camera.maxDistance}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI / 2.15}
        target={camera.target}
      />

      <Suspense fallback={null}>
        <LibraryEnvironment layout={layout} />

        <ContactShadows
          position={[bounds.centerX, 0.01, bounds.centerZ]}
          opacity={0.35}
          scale={shadowScale}
          blur={1.2}
          far={5}
          resolution={256}
          color="#3d2b1a"
        />

        {seats.map((seat) => {
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
            spawnPosition={spawn}
            targetPosition={avatarTarget}
            targetRotation={avatarRotation}
            status={myStatus}
            focusScore={myFocusScore}
            displayName={userName}
            showStatusBadge={showStatusBadge}
          />
        )}

        {[...peers.values()].map((peer) => {
          const peerSeat = findSeat(peer.seatId);
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
