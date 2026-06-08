/**
 * StudyTime — Focus Prediction service (single source of all runtime ML logic).
 *
 * The Random Forest is trained offline by `ml/train_focus_model.py`, which exports
 * a portable JSON (`focus_rf_model.json`) describing every tree, the StandardScaler
 * parameters, the class order and the feature importances. This module is the *only*
 * place that touches that model: it builds a feature vector from a user's sessions,
 * runs the forest, and turns the raw prediction into the card-ready shape the UI
 * needs (focus level, confidence, distraction risk, recommendation).
 *
 * The model JSON is ~2.4 MB, so this module is SERVER-ONLY: it reads the file with
 * `fs` once at module load (warm, cached for the process lifetime) rather than via a
 * static `import`, which would force TypeScript to infer a giant literal type and
 * bloat any bundle that touched it. Only `/api/focus-prediction` imports this module;
 * the dashboard card stays a thin presentation layer that calls that route.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// --------------------------------------------------------------------------- #
// Types
// --------------------------------------------------------------------------- #

export type FocusCategory = "High" | "Medium" | "Low";
export type DistractionRisk = "Low" | "Moderate" | "High";

/** Compact session shape the client sends (StudySession minus the heavy `samples`). */
export type SessionInput = {
  startedAt: string;
  focusMs: number;
  averageFocus: number;
  distractionEvents: number;
  events?: { type: string }[] | null;
};

/** The 8 model features, in the contractual training order. */
export type FocusFeatures = {
  session_duration: number;
  phone_detections: number;
  distraction_events: number;
  drowsiness_count: number;
  hour_of_day: number;
  day_of_week: number;
  streak_length: number;
  prev_session_focus_score: number;
};

export type FocusPrediction = {
  predictedFocus: FocusCategory;
  /** max(predict_proba row), 0–1 */
  confidence: number;
  distractionRisk: DistractionRisk;
  recommendation: string;
  /** Features ranked highest → lowest importance (for UI / transparency). */
  topFactors: { feature: string; importance: number }[];
};

type TreeJSON = {
  children_left: number[];
  children_right: number[];
  feature: number[];
  threshold: number[];
  value: number[][]; // per-node normalised class-probability vector
};

type ModelJSON = {
  feature_names: string[];
  classes: string[];
  scaler: { mean: number[]; scale: number[] };
  feature_importances: Record<string, number>;
  trees: TreeJSON[];
};

// Loaded once at module init from the project root (cwd is the project root under
// `next dev` / `next start`). Reused for every request — no per-request file I/O.
const MODEL_PATH = join(process.cwd(), "lib", "ml", "focus_rf_model.json");
const MODEL = JSON.parse(readFileSync(MODEL_PATH, "utf8")) as ModelJSON;

/** sklearn marks leaves with feature index -2 (TREE_UNDEFINED). */
const LEAF = -2;

/** Number of most-recent sessions used to summarise "typical" recent behaviour. */
const RECENT_WINDOW = 5;

// --------------------------------------------------------------------------- #
// Feature engineering (mirrors the columns the Python pipeline trained on)
// --------------------------------------------------------------------------- #

function countEvents(session: SessionInput, types: string[]): number {
  if (!session.events) return 0;
  return session.events.filter((e) => types.includes(e.type)).length;
}

/** Local day-of-week as 0=Mon … 6=Sun, matching the training convention. */
function mondayBasedDow(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Count consecutive study days ending today (today inclusive). Mirrors the app's
 * streak idea (lib/gamification/streaks.ts) but derived directly from session
 * dates so the feature needs no extra storage.
 */
function computeStreakLength(sessions: SessionInput[]): number {
  const dayKeys = new Set(
    sessions.map((s) => new Date(s.startedAt).toISOString().slice(0, 10)),
  );
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Allow the streak to "start" today or yesterday so an unfinished today still counts.
  if (!dayKeys.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dayKeys.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Build the feature vector that represents the user's *upcoming* session.
 * Recent behaviour (last few sessions) stands in for the duration / distraction
 * inputs; the temporal features use "now"; prev_session_focus_score is the most
 * recent session's average focus. Returns null when there's no history to learn from.
 */
export function buildFeatures(sessions: SessionInput[]): FocusFeatures | null {
  if (sessions.length === 0) return null;

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  const recent = sorted.slice(0, RECENT_WINDOW);
  const n = recent.length;

  const avg = (fn: (s: SessionInput) => number) =>
    recent.reduce((sum, s) => sum + fn(s), 0) / n;

  const now = new Date();
  return {
    session_duration: avg((s) => s.focusMs / 60000),
    phone_detections: avg((s) => countEvents(s, ["phone_detected"])),
    distraction_events: avg((s) => s.distractionEvents),
    drowsiness_count: avg((s) =>
      countEvents(s, ["eyes_closed_10s", "head_down_long"]),
    ),
    hour_of_day: now.getHours(),
    day_of_week: mondayBasedDow(now),
    streak_length: computeStreakLength(sessions),
    prev_session_focus_score: sorted[0].averageFocus,
  };
}

// --------------------------------------------------------------------------- #
// Random Forest inference (replicates sklearn predict / predict_proba exactly)
// --------------------------------------------------------------------------- #

/** z-score with the exported StandardScaler params, in trained feature order. */
function scaleFeatures(features: FocusFeatures): number[] {
  return MODEL.feature_names.map((name, i) => {
    const raw = features[name as keyof FocusFeatures];
    const scale = MODEL.scaler.scale[i] || 1;
    return (raw - MODEL.scaler.mean[i]) / scale;
  });
}

/** Walk one decision tree to its leaf and return that leaf's class-probability vector. */
function predictTree(tree: TreeJSON, x: number[]): number[] {
  let node = 0;
  while (tree.feature[node] !== LEAF) {
    const f = tree.feature[node];
    node = x[f] <= tree.threshold[node]
      ? tree.children_left[node]
      : tree.children_right[node];
  }
  return tree.value[node];
}

/**
 * Forest prediction = mean of per-tree probability vectors (sklearn's soft-vote).
 * Returns the winning category and its probability (the confidence).
 */
export function predict(features: FocusFeatures): {
  predictedFocus: FocusCategory;
  confidence: number;
} {
  const x = scaleFeatures(features);
  const classCount = MODEL.classes.length;
  const totals = new Array<number>(classCount).fill(0);

  for (const tree of MODEL.trees) {
    const probs = predictTree(tree, x);
    for (let c = 0; c < classCount; c++) totals[c] += probs[c];
  }

  let bestIdx = 0;
  for (let c = 1; c < classCount; c++) {
    if (totals[c] > totals[bestIdx]) bestIdx = c;
  }

  return {
    predictedFocus: MODEL.classes[bestIdx] as FocusCategory,
    confidence: totals[bestIdx] / MODEL.trees.length,
  };
}

// --------------------------------------------------------------------------- #
// Derived, human-facing fields
// --------------------------------------------------------------------------- #

const FEATURE_RANKING = Object.entries(MODEL.feature_importances).sort(
  (a, b) => b[1] - a[1],
);

/**
 * Distraction risk from the two behavioural features that most directly capture
 * it. Phones are weighted higher than generic distraction events because the
 * trained model ranks `phone_detections` well above `distraction_events`.
 */
export function assessDistractionRisk(features: FocusFeatures): DistractionRisk {
  const score =
    features.phone_detections * 2 +
    features.distraction_events +
    features.drowsiness_count * 1.5;
  if (score >= 6) return "High";
  if (score >= 2.5) return "Moderate";
  return "Low";
}

/**
 * One-to-two sentence recommendation grounded in actual feature importance:
 * we scan the model's importance ranking top-down and surface advice for the
 * highest-ranked feature that is currently unfavourable for this user.
 */
export function buildRecommendation(
  features: FocusFeatures,
  prediction: { predictedFocus: FocusCategory },
): string {
  for (const [feature] of FEATURE_RANKING) {
    switch (feature) {
      case "prev_session_focus_score":
        if (features.prev_session_focus_score < 60) {
          return "Your most recent session dipped in focus, and recent performance is the strongest predictor of your next one — start with a short, easy warm-up task to rebuild momentum.";
        }
        break;
      case "phone_detections":
        if (features.phone_detections >= 1) {
          return "Phone pickups are dragging your focus down the most — put your phone in another room or enable Do Not Disturb before your next session.";
        }
        break;
      case "session_duration":
        if (features.session_duration > 55) {
          return "Your recent blocks run long; very long sessions tend to lower sustained focus — try a 25–45 minute block with a real break afterwards.";
        }
        if (features.session_duration < 12) {
          return "Your sessions are quite short — extend toward a 25-minute focus block so momentum has time to build.";
        }
        break;
      case "hour_of_day":
        if (features.hour_of_day < 7 || features.hour_of_day >= 23) {
          return "You're studying at a low-energy hour — your focus tends to be higher mid-morning to late afternoon, so consider shifting this session earlier.";
        }
        break;
      case "distraction_events":
        if (features.distraction_events >= 3) {
          return "Frequent distraction events are eroding your focus — close unrelated tabs and try a single-task rule for the next block.";
        }
        break;
      case "drowsiness_count":
        if (features.drowsiness_count >= 1) {
          return "Signs of drowsiness are showing up in recent sessions — a short walk, water, or studying earlier in the day should help you stay alert.";
        }
        break;
      default:
        break;
    }
  }

  if (prediction.predictedFocus === "High") {
    return "Your recent patterns point to a strong, focused session — keep your current routine and protect this time block.";
  }
  return "Your inputs look balanced — keep distractions low and aim for a consistent 25-minute focus block to push into the High range.";
}

/** End-to-end: sessions → full card-ready prediction (composes everything above). */
export function derivePrediction(
  sessions: SessionInput[],
): FocusPrediction | null {
  const features = buildFeatures(sessions);
  if (!features) return null;

  const core = predict(features);
  return {
    predictedFocus: core.predictedFocus,
    confidence: core.confidence,
    distractionRisk: assessDistractionRisk(features),
    recommendation: buildRecommendation(features, core),
    topFactors: FEATURE_RANKING.slice(0, 3).map(([feature, importance]) => ({
      feature,
      importance,
    })),
  };
}
