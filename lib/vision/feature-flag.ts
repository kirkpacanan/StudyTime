/** Primary face runtime — set NEXT_PUBLIC_FOCUS_FACE_API=faceapi to compare legacy path in dev. */
export function useFaceLandmarkerPrimary(): boolean {
  return process.env.NEXT_PUBLIC_FOCUS_FACE_API !== "faceapi";
}
