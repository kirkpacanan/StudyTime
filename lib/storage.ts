import type {
  SessionTimerSettings,
  StoredUserSettings,
  StudySession,
  UserPreferences,
  UserRecord,
} from "./types";
import {
  DEFAULT_SESSION_TIMER_SETTINGS,
  DEFAULT_STORED_USER_SETTINGS,
  DEFAULT_USER_PREFERENCES,
} from "./types";
import { isSupabaseEnabled } from "./supabase/config";
import {
  fetchSessionsForUser as sbFetchSessions,
  fetchUserSettingsRaw as sbFetchSettingsRaw,
  insertStudySession as sbInsertSession,
  upsertUserSettings as sbUpsertSettings,
} from "./storage-supabase";

const KEYS = {
  users: "studytime_users",
  currentUserId: "studytime_current_user_id",
  sessions: "studytime_sessions",
  settings: "studytime_settings",
  bootstrapped: "studytime_bootstrapped",
} as const;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function clampNum(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Strip legacy scoring keys and normalize to allowed fields only. */
export function parseStoredSettings(
  raw: Record<string, unknown> = {},
): StoredUserSettings {
  return {
    webcamEnabled:
      typeof raw.webcamEnabled === "boolean"
        ? raw.webcamEnabled
        : DEFAULT_USER_PREFERENCES.webcamEnabled,
    notificationsEnabled:
      typeof raw.notificationsEnabled === "boolean"
        ? raw.notificationsEnabled
        : DEFAULT_USER_PREFERENCES.notificationsEnabled,
    phoneDetectionEnabled:
      typeof raw.phoneDetectionEnabled === "boolean"
        ? raw.phoneDetectionEnabled
        : DEFAULT_USER_PREFERENCES.phoneDetectionEnabled,
    focusMinutes: clampNum(
      Number(raw.focusMinutes),
      5,
      120,
      DEFAULT_SESSION_TIMER_SETTINGS.focusMinutes,
    ),
    shortBreakMinutes: clampNum(
      Number(raw.shortBreakMinutes),
      1,
      60,
      DEFAULT_SESSION_TIMER_SETTINGS.shortBreakMinutes,
    ),
    longBreakMinutes: clampNum(
      Number(raw.longBreakMinutes),
      1,
      60,
      DEFAULT_SESSION_TIMER_SETTINGS.longBreakMinutes,
    ),
    longBreakEvery: clampNum(
      Number(raw.longBreakEvery),
      1,
      10,
      DEFAULT_SESSION_TIMER_SETTINGS.longBreakEvery,
    ),
  };
}

async function loadStoredSettings(userId: string): Promise<StoredUserSettings> {
  if (isSupabaseEnabled()) {
    const raw = await sbFetchSettingsRaw(userId);
    return parseStoredSettings(raw);
  }
  const map = safeParse<Record<string, Record<string, unknown>>>(
    localStorage.getItem(KEYS.settings),
    {},
  );
  return parseStoredSettings(map[userId] ?? {});
}

async function saveStoredSettings(
  userId: string,
  settings: StoredUserSettings,
): Promise<void> {
  if (isSupabaseEnabled()) {
    await sbUpsertSettings(userId, settings);
    return;
  }
  const map = safeParse<Record<string, StoredUserSettings>>(
    localStorage.getItem(KEYS.settings),
    {},
  );
  map[userId] = settings;
  localStorage.setItem(KEYS.settings, JSON.stringify(map));
}

function localGetSessions(userId: string): StudySession[] {
  if (typeof window === "undefined") return [];
  const all = safeParse<StudySession[]>(
    localStorage.getItem(KEYS.sessions),
    [],
  );
  return all.filter((s) => s.userId === userId);
}

/** All sessions in localStorage (for pooled leaderboard in mock mode). */
export function getAllSessionsLocal(): StudySession[] {
  if (typeof window === "undefined") return [];
  return safeParse<StudySession[]>(
    localStorage.getItem(KEYS.sessions),
    [],
  );
}

/** Study sessions for a user (Supabase when configured, else localStorage). */
export async function getSessionsForUser(
  userId: string,
): Promise<StudySession[]> {
  if (isSupabaseEnabled()) return sbFetchSessions(userId);
  return localGetSessions(userId);
}

export async function appendSession(session: StudySession): Promise<void> {
  if (isSupabaseEnabled()) {
    await sbInsertSession(session);
    return;
  }
  const all = safeParse<StudySession[]>(
    localStorage.getItem(KEYS.sessions),
    [],
  );
  all.push(session);
  localStorage.setItem(KEYS.sessions, JSON.stringify(all));
}

export async function getUserPreferences(
  userId: string,
): Promise<UserPreferences> {
  const stored = await loadStoredSettings(userId);
  return {
    webcamEnabled: stored.webcamEnabled,
    notificationsEnabled: stored.notificationsEnabled,
    phoneDetectionEnabled: stored.phoneDetectionEnabled,
  };
}

export async function getSessionTimerSettings(
  userId: string,
): Promise<SessionTimerSettings> {
  const stored = await loadStoredSettings(userId);
  return {
    focusMinutes: stored.focusMinutes,
    shortBreakMinutes: stored.shortBreakMinutes,
    longBreakMinutes: stored.longBreakMinutes,
    longBreakEvery: stored.longBreakEvery,
  };
}

export async function saveUserPreferences(
  userId: string,
  preferences: UserPreferences,
): Promise<void> {
  const current = await loadStoredSettings(userId);
  await saveStoredSettings(userId, { ...current, ...preferences });
}

export async function saveSessionTimerSettings(
  userId: string,
  timer: SessionTimerSettings,
): Promise<void> {
  const current = await loadStoredSettings(userId);
  const normalized: SessionTimerSettings = {
    focusMinutes: clampNum(timer.focusMinutes, 5, 120, current.focusMinutes),
    shortBreakMinutes: clampNum(
      timer.shortBreakMinutes,
      1,
      60,
      current.shortBreakMinutes,
    ),
    longBreakMinutes: clampNum(
      timer.longBreakMinutes,
      1,
      60,
      current.longBreakMinutes,
    ),
    longBreakEvery: clampNum(
      timer.longBreakEvery,
      1,
      10,
      current.longBreakEvery,
    ),
  };
  await saveStoredSettings(userId, { ...current, ...normalized });
}

/** @deprecated Use getUserPreferences / getSessionTimerSettings */
export async function getSettings(userId: string): Promise<StoredUserSettings> {
  return loadStoredSettings(userId);
}

/** @deprecated Use saveUserPreferences / saveSessionTimerSettings */
export async function saveSettings(
  userId: string,
  settings: StoredUserSettings,
): Promise<void> {
  await saveStoredSettings(userId, parseStoredSettings(settings));
}

// --- Local mock auth only (ignored when Supabase auth is active) ---

export function getUsers(): UserRecord[] {
  if (typeof window === "undefined") return [];
  return safeParse<UserRecord[]>(localStorage.getItem(KEYS.users), []);
}

export function saveUsers(users: UserRecord[]) {
  localStorage.setItem(KEYS.users, JSON.stringify(users));
}

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.currentUserId);
}

export function setCurrentUserId(id: string | null) {
  if (id) localStorage.setItem(KEYS.currentUserId, id);
  else localStorage.removeItem(KEYS.currentUserId);
}

export function isBootstrapped(): boolean {
  return localStorage.getItem(KEYS.bootstrapped) === "1";
}

export function setBootstrapped() {
  localStorage.setItem(KEYS.bootstrapped, "1");
}

export { KEYS as STORAGE_KEYS };
