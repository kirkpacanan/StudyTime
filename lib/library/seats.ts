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

/** 12 seats arranged across 3 tables of 4 in a spacious library layout. */
export const LIBRARY_SEATS: SeatPosition[] = [
  // Table 1 — left side
  { id: "t1-s1", label: "Table 1 · A", position: [-5, 0, -2], rotation: 0,          table: 1 },
  { id: "t1-s2", label: "Table 1 · B", position: [-5, 0,  2], rotation: Math.PI,    table: 1 },
  { id: "t1-s3", label: "Table 1 · C", position: [-3, 0, -2], rotation: 0,          table: 1 },
  { id: "t1-s4", label: "Table 1 · D", position: [-3, 0,  2], rotation: Math.PI,    table: 1 },

  // Table 2 — center
  { id: "t2-s1", label: "Table 2 · A", position: [ 0, 0, -2], rotation: 0,          table: 2 },
  { id: "t2-s2", label: "Table 2 · B", position: [ 0, 0,  2], rotation: Math.PI,    table: 2 },
  { id: "t2-s3", label: "Table 2 · C", position: [ 2, 0, -2], rotation: 0,          table: 2 },
  { id: "t2-s4", label: "Table 2 · D", position: [ 2, 0,  2], rotation: Math.PI,    table: 2 },

  // Table 3 — right side
  { id: "t3-s1", label: "Table 3 · A", position: [ 5, 0, -2], rotation: 0,          table: 3 },
  { id: "t3-s2", label: "Table 3 · B", position: [ 5, 0,  2], rotation: Math.PI,    table: 3 },
  { id: "t3-s3", label: "Table 3 · C", position: [ 7, 0, -2], rotation: 0,          table: 3 },
  { id: "t3-s4", label: "Table 3 · D", position: [ 7, 0,  2], rotation: Math.PI,    table: 3 },
];

/** Center of each table (for placing the table mesh). */
export const TABLE_CENTERS: [number, number, number][] = [
  [-4,   0, 0],
  [ 1,   0, 0],
  [ 6,   0, 0],
];

export function getSeatById(id: string): SeatPosition | undefined {
  return LIBRARY_SEATS.find((s) => s.id === id);
}
