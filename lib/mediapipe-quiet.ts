/** MediaPipe Wasm routes stderr (including INFO) through console.error. */
const MEDIAPIPE_STDERR_NOISE = [
  /TensorFlow Lite/i,
  /XNNPACK/i,
  /Created TensorFlow/i,
  /^\s*INFO:/i,
];

function isMediapipeStderrNoise(args: unknown[]): boolean {
  const text = args.map((a) => (typeof a === "string" ? a : String(a))).join(" ");
  return MEDIAPIPE_STDERR_NOISE.some((re) => re.test(text));
}

/** Run sync MediaPipe work without spamming Next.js devtools with Wasm INFO logs. */
export function withMediapipeQuiet<T>(fn: () => T): T {
  const prev = console.error;
  console.error = (...args: unknown[]) => {
    if (isMediapipeStderrNoise(args)) return;
    prev.apply(console, args);
  };
  try {
    return fn();
  } finally {
    console.error = prev;
  }
}

/** Async variant for model load + detectForVideo. */
export async function withMediapipeQuietAsync<T>(fn: () => Promise<T>): Promise<T> {
  const prev = console.error;
  console.error = (...args: unknown[]) => {
    if (isMediapipeStderrNoise(args)) return;
    prev.apply(console, args);
  };
  try {
    return await fn();
  } finally {
    console.error = prev;
  }
}
