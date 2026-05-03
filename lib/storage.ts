import type { StudySession, UserRecord, UserSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

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

export function getSessionsForUser(userId: string): StudySession[] {
  const all = safeParse<StudySession[]>(
    localStorage.getItem(KEYS.sessions),
    [],
  );
  return all.filter((s) => s.userId === userId);
}

export function appendSession(session: StudySession) {
  const all = safeParse<StudySession[]>(
    localStorage.getItem(KEYS.sessions),
    [],
  );
  all.push(session);
  localStorage.setItem(KEYS.sessions, JSON.stringify(all));
}

export function getSettings(userId: string): UserSettings {
  const map = safeParse<Record<string, UserSettings>>(
    localStorage.getItem(KEYS.settings),
    {},
  );
  return { ...DEFAULT_SETTINGS, ...map[userId] };
}

export function saveSettings(userId: string, settings: UserSettings) {
  const map = safeParse<Record<string, UserSettings>>(
    localStorage.getItem(KEYS.settings),
    {},
  );
  map[userId] = settings;
  localStorage.setItem(KEYS.settings, JSON.stringify(map));
}

export function isBootstrapped(): boolean {
  return localStorage.getItem(KEYS.bootstrapped) === "1";
}

export function setBootstrapped() {
  localStorage.setItem(KEYS.bootstrapped, "1");
}

export { KEYS as STORAGE_KEYS };
