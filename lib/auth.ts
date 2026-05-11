import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { UserRecord } from "./types";
import { digestHex, randomSalt } from "./password";
import {
  getCurrentUserId,
  getUsers,
  saveSettings,
  saveUsers,
  setCurrentUserId,
} from "./storage";
import { getSupabaseBrowser } from "./supabase/client";
import { isSupabaseEnabled, supabaseRequiredMessage } from "./supabase/config";

export type PublicUser = Omit<UserRecord, "passwordHash" | "salt">;

function toPublic(u: UserRecord): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.createdAt,
  };
}

export function mapSupabaseUser(user: SupabaseUser): PublicUser {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const name =
    (typeof meta?.name === "string" && meta.name.trim()) ||
    user.email?.split("@")[0] ||
    "Student";
  return {
    id: user.id,
    email: user.email ?? "",
    name,
    createdAt: user.created_at ?? new Date().toISOString(),
  };
}

export function getCurrentUser(): PublicUser | null {
  if (isSupabaseEnabled()) return null;
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

  /** New accounts must be created in Supabase only — no local mock sign-up. */
  if (!isSupabaseEnabled()) {
    return { ok: false, error: supabaseRequiredMessage() };
  }

  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.auth.signUp({
    email: normalized,
    password,
    options: {
      data: { name: name.trim() || "Student" },
    },
  });
  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "Sign up failed." };
  if (!data.session) {
    return {
      ok: false,
      error:
        "Account created. Confirm your email if required, then sign in (check Supabase Auth settings).",
    };
  }
  return { ok: true, user: mapSupabaseUser(data.user) };
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();

  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });
    if (error) return { ok: false, error: error.message };
    if (!data.user) return { ok: false, error: "Invalid email or password." };
    return { ok: true, user: mapSupabaseUser(data.user) };
  }

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

export async function signOut(): Promise<void> {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    return;
  }
  setCurrentUserId(null);
}

/** For demo / tests: reset password for known user (local auth only). */
export async function setUserPassword(userId: string, password: string) {
  if (isSupabaseEnabled()) return;
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
