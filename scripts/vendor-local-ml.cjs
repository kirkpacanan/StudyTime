/**
 * Copies MediaPipe Tasks Vision Wasm from node_modules → public/mediapipe/wasm
 * so ObjectDetector loads fully from the app's origin (no jsDelivr).
 * Downloads EfficientDet-Lite2 .tflite into public/models/object_detector/ once
 * (skips if file already present and sizable), so inference needs no Google CDN.
 *
 * Runs on postinstall / `npm run vendor:ml`.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const root = path.join(__dirname, "..");
const wasmSrc = path.join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDest = path.join(root, "public/mediapipe/wasm");
const modelDir = path.join(root, "public/models/object_detector");
const modelFile = path.join(modelDir, "efficientdet_lite2.tflite");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float32/1/efficientdet_lite2.tflite";
const faceModelDir = path.join(root, "public/models/face_landmarker");
const faceModelFile = path.join(faceModelDir, "face_landmarker.task");
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

function copyWasm() {
  if (!fs.existsSync(wasmSrc)) {
    console.warn(
      "[vendor-local-ml] @mediapipe/tasks-vision/wasm missing (skip wasm copy)",
    );
    return;
  }
  fs.mkdirSync(wasmDest, { recursive: true });
  for (const name of fs.readdirSync(wasmSrc)) {
    fs.copyFileSync(path.join(wasmSrc, name), path.join(wasmDest, name));
  }
  console.log("[vendor-local-ml] MediaPipe Wasm → public/mediapipe/wasm");
}

function downloadModelIfNeeded() {
  if (fs.existsSync(modelFile) && fs.statSync(modelFile).size > 512 * 1024) {
    console.log("[vendor-local-ml] object detector model already present");
    return Promise.resolve();
  }
  fs.mkdirSync(modelDir, { recursive: true });
  const tmp = `${modelFile}.tmp`;
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tmp);
    https
      .get(MODEL_URL, (res) => {
        if (res.statusCode !== 200) {
          file.close(() => fs.unlink(tmp, () => {}));
          reject(new Error(`Model HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            try {
              fs.renameSync(tmp, modelFile);
            } catch (e) {
              reject(e);
              return;
            }
            console.log(
              "[vendor-local-ml] downloaded EfficientDet-Lite2 (.tflite)",
            );
            resolve();
          });
        });
      })
      .on("error", (err) => {
        file.close(() => fs.unlink(tmp, () => {}));
        reject(err);
      });
  });
}

function downloadFileIfNeeded(url, destPath, tmpPath, minBytes, label) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > minBytes) {
    console.log(`[vendor-local-ml] ${label} already present`);
    return Promise.resolve();
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tmpPath);
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          file.close(() => fs.unlink(tmpPath, () => {}));
          reject(new Error(`${label} HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            try {
              fs.renameSync(tmpPath, destPath);
            } catch (e) {
              reject(e);
              return;
            }
            console.log(`[vendor-local-ml] downloaded ${label}`);
            resolve();
          });
        });
      })
      .on("error", (err) => {
        file.close(() => fs.unlink(tmpPath, () => {}));
        reject(err);
      });
  });
}

async function downloadFaceLandmarkerIfNeeded() {
  return downloadFileIfNeeded(
    FACE_MODEL_URL,
    faceModelFile,
    `${faceModelFile}.tmp`,
    1024 * 1024,
    "Face Landmarker (.task)",
  );
}

async function main() {
  copyWasm();
  try {
    await downloadModelIfNeeded();
    await downloadFaceLandmarkerIfNeeded();
  } catch (e) {
    console.warn("[vendor-local-ml] Could not fetch phone model:", e.message);
    console.warn(
      "  Run with network once: npm run vendor:ml — or commit public/models/object_detector/efficientdet_lite2.tflite",
    );
    if (process.env.npm_lifecycle_event !== "postinstall") {
      process.exitCode = 1;
    }
  }
}

main();
