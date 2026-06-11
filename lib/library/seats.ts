/**
 * Static seat layout for the 3D library.
 * Positions are in Three.js world space: [x, y, z].
 * The library floor is at y=0; avatars stand/sit at y=0.
 */

export type SeatPosition = {
  id: string;
  label: string;
  position: [number, number, number];
  /** Rotation around Y axis in radians — which way the avatar faces when sitting. */
  rotation: number;
  /** Table group this seat belongs to (for visual grouping). */
  table: number;
};

export type LibraryLayoutBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  wallBackZ: number;
  wallFrontZ: number;
  wallLeftX: number;
  wallRightX: number;
};

export type LibraryLayout = {
  seatCount: number;
  seats: SeatPosition[];
  tableIds: number[];
  tableCenters: [number, number, number][];
  bounds: LibraryLayoutBounds;
  spawn: [number, number, number];
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    minDistance: number;
    maxDistance: number;
  };
  fog: { near: number; far: number };
  isCompact: boolean;
};

export const LIBRARY_SEAT_COUNT = 60;
export const MIN_LIBRARY_PARTICIPANTS = 2;
export const MAX_LIBRARY_PARTICIPANTS = LIBRARY_SEAT_COUNT;

const COL_X = [-7, 7] as const;
const ROW_Z = [-20, -10, 0, 10, 20] as const;

const FULL_ROOM_BOUNDS: LibraryLayoutBounds = {
  minX: -8.5,
  maxX: 8.5,
  minZ: -22,
  maxZ: 22,
  centerX: 0,
  centerZ: 0,
  width: 36,
  depth: 54,
  wallBackZ: -27,
  wallFrontZ: 27,
  wallLeftX: -18,
  wallRightX: 18,
};

function makeTable(tableIdx: number, cx: number, cz: number): SeatPosition[] {
  const t = tableIdx + 1;
  return [
    { id: `t${t}-a1`, label: `Table ${t} · A1`, position: [cx - 1.5, 0, cz - 2], rotation: 0, table: t },
    { id: `t${t}-a2`, label: `Table ${t} · A2`, position: [cx, 0, cz - 2], rotation: 0, table: t },
    { id: `t${t}-a3`, label: `Table ${t} · A3`, position: [cx + 1.5, 0, cz - 2], rotation: 0, table: t },
    { id: `t${t}-b1`, label: `Table ${t} · B1`, position: [cx - 1.5, 0, cz + 2], rotation: Math.PI, table: t },
    { id: `t${t}-b2`, label: `Table ${t} · B2`, position: [cx, 0, cz + 2], rotation: Math.PI, table: t },
    { id: `t${t}-b3`, label: `Table ${t} · B3`, position: [cx + 1.5, 0, cz + 2], rotation: Math.PI, table: t },
  ];
}

/** 60 seats across 10 study tables — 2 columns × 5 rows, 6 seats per table. */
export const LIBRARY_SEATS: SeatPosition[] = ROW_Z.flatMap((cz, ri) =>
  COL_X.map((cx, ci) => makeTable(ri * COL_X.length + ci, cx, cz)),
).flat();

/** Default spawn for the full Main Library. */
export const AVATAR_SPAWN: [number, number, number] = [-17, 0, 0];

/** Centre of each table — 10 entries in row-major order. */
export const TABLE_CENTERS: [number, number, number][] = ROW_Z.flatMap((cz) =>
  COL_X.map((cx): [number, number, number] => [cx, 0, cz]),
);

export function clampParticipantLimit(limit: number): number {
  return Math.min(MAX_LIBRARY_PARTICIPANTS, Math.max(MIN_LIBRARY_PARTICIPANTS, limit));
}

/** First N seats in layout order for a room's participant cap. */
export function getActiveSeats(limit?: number): SeatPosition[] {
  const n = limit == null ? LIBRARY_SEAT_COUNT : clampParticipantLimit(limit);
  return LIBRARY_SEATS.slice(0, n);
}

/** Table indices (1-based) that have at least one active seat. */
export function getActiveTableIds(limit?: number): number[] {
  const ids = new Set(getActiveSeats(limit).map((s) => s.table));
  return [...ids].sort((a, b) => a - b);
}

function computeBoundsFromSeats(seats: SeatPosition[]): LibraryLayoutBounds {
  if (seats.length === 0) {
    return { ...FULL_ROOM_BOUNDS };
  }

  const xs = seats.map((s) => s.position[0]);
  const zs = seats.map((s) => s.position[2]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);

  const padX = 5.5;
  const padZ = 6.5;
  const studyWidth = maxX - minX + padX * 2;
  const studyDepth = maxZ - minZ + padZ * 2;
  const width = Math.max(16, Math.min(36, studyWidth));
  const depth = Math.max(14, Math.min(54, studyDepth));

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const halfW = width / 2;
  const halfD = depth / 2;

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX,
    centerZ,
    width,
    depth,
    wallBackZ: centerZ - halfD,
    wallFrontZ: centerZ + halfD,
    wallLeftX: centerX - halfW,
    wallRightX: centerX + halfW,
  };
}

/** Layout metadata for scaling the 3D study hall to the active seat count. */
export function getLibraryLayout(limit?: number): LibraryLayout {
  const seatCount = limit == null ? LIBRARY_SEAT_COUNT : clampParticipantLimit(limit);
  const seats = getActiveSeats(limit);
  const tableIds = getActiveTableIds(limit);
  const tableCenters = tableIds.map((id) => TABLE_CENTERS[id - 1]);
  const isCompact = seatCount < LIBRARY_SEAT_COUNT;

  const bounds = isCompact
    ? computeBoundsFromSeats(seats)
    : { ...FULL_ROOM_BOUNDS };

  const spawn: [number, number, number] = isCompact
    ? [bounds.wallLeftX + 2.5, 0, bounds.centerZ]
    : AVATAR_SPAWN;

  const camHeight = isCompact
    ? Math.max(14, Math.min(20, bounds.depth * 0.55))
    : 20;
  const camDist = isCompact
    ? Math.max(10, Math.min(18, bounds.depth * 0.42))
    : 22;

  const camera = {
    position: [bounds.centerX, camHeight, bounds.centerZ + camDist] as [number, number, number],
    target: [bounds.centerX, 0, bounds.centerZ] as [number, number, number],
    minDistance: isCompact ? Math.max(8, bounds.width * 0.45) : 12,
    maxDistance: isCompact ? Math.max(14, bounds.depth * 1.1) : 42,
  };

  const fog = {
    near: isCompact ? Math.max(12, bounds.depth * 0.35) : 28,
    far: isCompact ? Math.max(28, bounds.depth * 1.35) : 85,
  };

  return {
    seatCount,
    seats,
    tableIds,
    tableCenters,
    bounds,
    spawn,
    camera,
    fog,
    isCompact,
  };
}

export function getSeatById(id: string): SeatPosition | undefined {
  return LIBRARY_SEATS.find((s) => s.id === id);
}

/** Chair cushion offset inside StudyChair (local Z from seat origin). */
const CHAIR_SEAT_FORWARD = 0.4;

export function getSeatAvatarPosition(seat: SeatPosition): [number, number, number] {
  const angle = seat.rotation + Math.PI;
  const dx = Math.sin(angle) * CHAIR_SEAT_FORWARD;
  const dz = Math.cos(angle) * CHAIR_SEAT_FORWARD;
  return [seat.position[0] + dx, seat.position[1], seat.position[2] + dz];
}
