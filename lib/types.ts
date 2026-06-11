export type FocusSampleState =
  | "focused"
  | "drifting"
  | "distracted"
  | "away"
  | "sleeping";

export type SessionEventType =
  | "session_start"
  | "phone_detected"
  | "look_away_long"
  | "drift"
  | "off_screen"
  | "head_down_long"
  | "eyes_closed_10s"
  | "alarm_started"
  | "alarm_stopped";

export type MonitoringSnapshotEventType =
  | "session_start"
  | "phone_detected"
  | "off_screen"
  | "drift";

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
  /** Private library room when session was completed in a study room */
  roomId?: string | null;
};

export type FocusSensitivity = "strict" | "balanced" | "accessible";

/** Non-scoring preferences (Settings page). */
export type UserPreferences = {
  webcamEnabled: boolean;
  notificationsEnabled: boolean;
  phoneDetectionEnabled: boolean;
};

/** Pomodoro / break timer (Study Session page). */
export type SessionTimerSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
};

/** Persisted blob in user_settings.settings (scoring keys stripped on read). */
export type StoredUserSettings = UserPreferences & SessionTimerSettings;

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  webcamEnabled: true,
  notificationsEnabled: false,
  phoneDetectionEnabled: true,
};

export const CLASSIC_POMODORO_SETTINGS: SessionTimerSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
};

export const DEFAULT_SESSION_TIMER_SETTINGS: SessionTimerSettings = {
  ...CLASSIC_POMODORO_SETTINGS,
};

export const DEFAULT_STORED_USER_SETTINGS: StoredUserSettings = {
  ...DEFAULT_USER_PREFERENCES,
  ...DEFAULT_SESSION_TIMER_SETTINGS,
};

export type LiveSessionSnapshot = {
  running: boolean;
  phase: "focus" | "break";
  focusState: FocusSampleState | null;
  score: number | null;
};
