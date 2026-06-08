export type FocusSampleState =
  | "focused"
  | "drifting"
  | "distracted"
  | "away"
  | "sleeping";

export type SessionEventType =
  | "phone_detected"
  | "look_away_long"
  | "head_down_long"
  | "eyes_closed_10s"
  | "alarm_started"
  | "alarm_stopped";

export type SessionEvent = {
  /** Session-relative timestamp (ms) */
  t: number;
  type: SessionEventType;
  meta?: Record<string, unknown>;
};

export type FocusSample = {
  t: number;
  score: number;
  state: FocusSampleState;
  /**
   * Optional per-sample flags for debugging/UX; kept optional for backwards compatibility
   * with existing stored sessions.
   */
  flags?: {
    phoneDetected?: boolean;
    lookingAway?: boolean;
    headDown?: boolean;
    eyesClosed?: boolean;
    drowsy?: boolean;
    hasFace?: boolean;
  };
};

export type StudySession = {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string;
  focusMs: number;
  breakMs: number;
  averageFocus: number;
  focusedRatio: number;
  distractionEvents: number;
  samples: FocusSample[];
  /** Optional discrete events (new schema; old sessions won't have it) */
  events?: SessionEvent[];
};

export type FocusSensitivity = "strict" | "balanced" | "accessible";

export type UserSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  focusThreshold: number;
  distractionThreshold: number;
  webcamEnabled: boolean;
  notificationsEnabled: boolean;
  phoneDetectionEnabled: boolean;
  /** How aggressively focus/drowsiness penalties apply. */
  focusSensitivity: FocusSensitivity;
  /** Bias head-down posture toward desk-work (notes) instead of distraction. */
  deskWorkBias: boolean;
};

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

export const DEFAULT_SETTINGS: UserSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  focusThreshold: 70,
  distractionThreshold: 40,
  webcamEnabled: true,
  notificationsEnabled: false,
  phoneDetectionEnabled: true,
  focusSensitivity: "balanced",
  deskWorkBias: true,
};

export type LiveSessionSnapshot = {
  running: boolean;
  phase: "focus" | "break";
  focusState: FocusSampleState | null;
  score: number | null;
};
