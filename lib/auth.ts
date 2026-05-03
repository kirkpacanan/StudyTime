import type { UserRecord } from "./types";
import { digestHex, randomSalt } from "./password";
import {
  getCurrentUserId,
  getUsers,
  saveSettings,
  saveUsers,
  setCurrentUserId,
} from "./storage";
import { DEFAULT_SETTINGS } from "./types";

export type PublicUser = Omit<UserRecord, "passwordHash" | "salt">;

function toPublic(u: UserRecord): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.createdAt,
  };
}

export function getCurrentUser(): PublicUser | null {
  const id = getCurrentUserId();
  if (!id) return null;
  const u = getUsers().find((x) => x.id === id);
  return u ? toPublic(u) : null;
}

export async function signUp(
  email: string,
  password: string,
  name: string,
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) {
    return { ok: false, error: "Email and password are required." };
  }
  const users = getUsers();
  if (users.some((u) => u.email === normalized)) {
    return { ok: false, error: "An account with this email already exists." };
  }
  const salt = randomSalt();
  const passwordHash = await digestHex(password + salt);
  const user: UserRecord = {
    id: crypto.randomUUID(),
    email: normalized,
    name: name.trim() || "Student",
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  saveSettings(user.id, { ...DEFAULT_SETTINGS });
  setCurrentUserId(user.id);
  return { ok: true, user: toPublic(user) };
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  const users = getUsers();
  const user = users.find((u) => u.email === normalized);
  if (!user) return { ok: false, error: "Invalid email or password." };
  const hash = await digestHex(password + user.salt);
  if (hash !== user.passwordHash) {
    return { ok: false, error: "Invalid email or password." };
  }
  setCurrentUserId(user.id);
  return { ok: true, user: toPublic(user) };
}

export function signOut() {
  setCurrentUserId(null);
}

/** For demo / tests: reset password for known user */
export async function setUserPassword(userId: string, password: string) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return;
  const salt = randomSalt();
  users[idx] = {
    ...users[idx],
    salt,
    passwordHash: await digestHex(password + salt),
  };
  saveUsers(users);
}
