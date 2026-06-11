/** Screen share + paired webcam/screen JPEG capture for activity room evidence. */

const MAX_DIM = 640;
const JPEG_QUALITY = 0.72;

let screenStream: MediaStream | null = null;
let screenVideo: HTMLVideoElement | null = null;

function ensureScreenVideo(): HTMLVideoElement {
  if (!screenVideo) {
    screenVideo = document.createElement("video");
    screenVideo.muted = true;
    screenVideo.playsInline = true;
  }
  return screenVideo;
}

export function hasScreenCapturePermission(): boolean {
  return Boolean(screenStream?.active);
}

export function stopScreenCapture(): void {
  screenStream?.getTracks().forEach((t) => t.stop());
  screenStream = null;
  if (screenVideo) {
    screenVideo.srcObject = null;
  }
}

/** Must be called from a user gesture (click). */
export async function requestScreenCapture(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    return false;
  }
  try {
    stopScreenCapture();
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "monitor" } as MediaTrackConstraints,
      audio: false,
    });
    const track = stream.getVideoTracks()[0];
    if (!track) {
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }
    track.addEventListener("ended", () => stopScreenCapture());
    screenStream = stream;
    const video = ensureScreenVideo();
    video.srcObject = stream;
    await video.play();
    return true;
  } catch {
    stopScreenCapture();
    return false;
  }
}

async function captureFromVideo(video: HTMLVideoElement): Promise<Blob | null> {
  if (video.readyState < 2 || !video.videoWidth) return null;
  const w = Math.min(MAX_DIM, video.videoWidth);
  const h = Math.round((w * video.videoHeight) / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY);
  });
}

export async function captureScreenFrame(): Promise<Blob | null> {
  if (!screenStream?.active) return null;
  const video = ensureScreenVideo();
  if (video.readyState < 2) {
    await new Promise<void>((resolve) => {
      const onReady = () => {
        video.removeEventListener("loadeddata", onReady);
        resolve();
      };
      video.addEventListener("loadeddata", onReady);
      window.setTimeout(resolve, 400);
    });
  }
  return captureFromVideo(video);
}

export type PairedEvidenceBlobs = {
  webcam: Blob | null;
  screen: Blob | null;
};

export async function capturePairedEvidence(
  webcamCapture: (() => Promise<Blob | null>) | null,
): Promise<PairedEvidenceBlobs> {
  const [webcam, screen] = await Promise.all([
    webcamCapture ? webcamCapture() : Promise.resolve(null),
    captureScreenFrame(),
  ]);
  return { webcam, screen };
}
