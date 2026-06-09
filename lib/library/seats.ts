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

// ---------------------------------------------------------------------------
// 2 columns × 5 rows = 10 tables × 5 seats = 50 seats
//
// Column X centres: {-7, 7}        — 10-unit central aisle between columns
// Row    Z centres: {-20,-10,0,10,20} — 10 units between rows
//
// Each table has 5 seats:
//   Side A — 3 seats facing +Z  at z = cz - 2  (rotation 0)
//   Side B — 2 seats facing -Z  at z = cz + 2  (rotation π)
//
// Seat X on side A: cx + {-1.5, 0, +1.5}
// Seat X on side B: cx + {-1,       +1}
// ---------------------------------------------------------------------------

const COL_X = [-7, 7]                  as const;
const ROW_Z = [-20, -10, 0, 10, 20]   as const;

function makeTable(tableIdx: number, cx: number, cz: number): SeatPosition[] {
  const t = tableIdx + 1;
  return [
    // Side A — 3 seats facing +Z
    { id: `t${t}-a1`, label: `Table ${t} · A1`, position: [cx - 1.5, 0, cz - 2], rotation: 0,       table: t },
    { id: `t${t}-a2`, label: `Table ${t} · A2`, position: [cx,       0, cz - 2], rotation: 0,       table: t },
    { id: `t${t}-a3`, label: `Table ${t} · A3`, position: [cx + 1.5, 0, cz - 2], rotation: 0,       table: t },
    // Side B — 3 seats facing -Z (symmetric with side A)
    { id: `t${t}-b1`, label: `Table ${t} · B1`, position: [cx - 1.5, 0, cz + 2], rotation: Math.PI, table: t },
    { id: `t${t}-b2`, label: `Table ${t} · B2`, position: [cx,       0, cz + 2], rotation: Math.PI, table: t },
    { id: `t${t}-b3`, label: `Table ${t} · B3`, position: [cx + 1.5, 0, cz + 2], rotation: Math.PI, table: t },
  ];
}

/** 60 seats across 10 study tables — 2 columns × 5 rows, 6 seats per table (3 per side). */
export const LIBRARY_SEATS: SeatPosition[] = ROW_Z.flatMap((cz, ri) =>
  COL_X.map((cx, ci) => makeTable(ri * COL_X.length + ci, cx, cz)),
).flat();

/** Where the local user's avatar spawns before walking to a seat (left entrance). */
export const AVATAR_SPAWN: [number, number, number] = [-17, 0, 0];

/** Centre of each table — 10 entries in row-major order. */
export const TABLE_CENTERS: [number, number, number][] = ROW_Z.flatMap((cz) =>
  COL_X.map((cx): [number, number, number] => [cx, 0, cz]),
);

export function getSeatById(id: string): SeatPosition | undefined {
  return LIBRARY_SEATS.find((s) => s.id === id);
}

/** Chair cushion offset inside StudyChair (local Z from seat origin). */
const CHAIR_SEAT_FORWARD = 0.4;

/**
 * World position where the avatar should stand/sit — aligned with the stool cushion,
 * not the raw seat marker origin.
 */
export function getSeatAvatarPosition(seat: SeatPosition): [number, number, number] {
  const angle = seat.rotation + Math.PI;
  const dx = Math.sin(angle) * CHAIR_SEAT_FORWARD;
  const dz = Math.cos(angle) * CHAIR_SEAT_FORWARD;
  return [seat.position[0] + dx, seat.position[1], seat.position[2] + dz];
}
