export type FocusSampleState =
  | "focused"
  | "drifting"
  | "distracted"
  | "away";

export type FocusSample = {
  t: number;
  score: number;
  state: FocusSampleState;
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
};

export type UserSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  focusThreshold: number;
  distractionThreshold: number;
  webcamEnabled: boolean;
  notificationsEnabled: boolean;
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
};

export type LiveSessionSnapshot = {
  running: boolean;
  phase: "focus" | "break";
  focusState: FocusSampleState | null;
  score: number | null;
};
