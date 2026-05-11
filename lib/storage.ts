import type { StudySession, UserRecord, UserSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { isSupabaseEnabled } from "./supabase/config";
import {
  fetchSessionsForUser as sbFetchSessions,
  fetchUserSettings as sbFetchSettings,
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

function localGetSessions(userId: string): StudySession[] {
  if (typeof window === "undefined") return [];
  const all = safeParse<StudySession[]>(
    localStorage.getItem(KEYS.sessions),
    [],
  );
  return all.filter((s) => s.userId === userId);
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

export async function getSettings(userId: string): Promise<UserSettings> {
  if (isSupabaseEnabled()) return sbFetchSettings(userId);
  const map = safeParse<Record<string, UserSettings>>(
    localStorage.getItem(KEYS.settings),
    {},
  );
  return { ...DEFAULT_SETTINGS, ...map[userId] };
}

export async function saveSettings(
  userId: string,
  settings: UserSettings,
): Promise<void> {
  if (isSupabaseEnabled()) {
    await sbUpsertSettings(userId, settings);
    return;
  }
  const map = safeParse<Record<string, UserSettings>>(
    localStorage.getItem(KEYS.settings),
    {},
  );
  map[userId] = settings;
  localStorage.setItem(KEYS.settings, JSON.stringify(map));
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
