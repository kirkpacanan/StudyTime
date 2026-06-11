import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { UserRecord } from "./types";
import { digestHex, randomSalt } from "./password";
import {
  getCurrentUserId,
  getUsers,
  saveUsers,
  setCurrentUserId,
} from "./storage";
import { clearLeaderboardCache } from "./gamification/leaderboard-cache";
import { getSupabaseBrowser } from "./supabase/client";
import { isSupabaseEnabled, supabaseRequiredMessage } from "./supabase/config";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  isDemoCredentials,
  seedDemoCloudProfile,
} from "./seed-demo";

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
  birthday?: string,
): Promise<
  | { ok: true; user: PublicUser; hasSession: boolean }
  | { ok: false; error: string }
> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  /** New accounts must be created in Supabase only — no local mock sign-up. */
  if (!isSupabaseEnabled()) {
    return { ok: false, error: supabaseRequiredMessage() };
  }

  const supabase = getSupabaseBrowser();
  // For immediate session + dashboard redirect: Supabase Dashboard → Authentication
  // → Providers → Email → turn off "Confirm email".
  const { data, error } = await supabase.auth.signUp({
    email: normalized,
    password,
    options: {
      data: {
        name: name.trim() || "Student",
        birthday: birthday ?? null,
      },
    },
  });
  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "Sign up failed." };
  return {
    ok: true,
    user: mapSupabaseUser(data.user),
    hasSession: !!data.session,
  };
}

export async function resetPasswordForEmail(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseEnabled()) {
    return { ok: false, error: supabaseRequiredMessage() };
  }
  const supabase = getSupabaseBrowser();
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/reset-password`
      : "/reset-password";
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function finishDemoSupabaseSignIn(
  user: Parameters<typeof mapSupabaseUser>[0],
): Promise<{ ok: true; user: PublicUser }> {
  await seedDemoCloudProfile(user.id);
  return { ok: true, user: mapSupabaseUser(user) };
}

/** Demo login when Supabase is on — recreates the account if the DB was wiped. */
async function signInOrProvisionDemoSupabase(): Promise<
  { ok: true; user: PublicUser } | { ok: false; error: string }
> {
  const supabase = getSupabaseBrowser();
  const creds = { email: DEMO_EMAIL, password: DEMO_PASSWORD };

  const attemptSignIn = () => supabase.auth.signInWithPassword(creds);

  let { data, error } = await attemptSignIn();
  if (!error && data.user) {
    return finishDemoSupabaseSignIn(data.user);
  }

  const signUp = await supabase.auth.signUp({
    ...creds,
    options: { data: { name: "Demo Student" } },
  });

  if (signUp.error) {
    const msg = signUp.error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      const retry = await attemptSignIn();
      if (!retry.error && retry.data.user) {
        return finishDemoSupabaseSignIn(retry.data.user);
      }
      if (retry.error) return { ok: false, error: retry.error.message };
    }
    return { ok: false, error: signUp.error.message };
  }

  if (signUp.data.session && signUp.data.user) {
    return finishDemoSupabaseSignIn(signUp.data.user);
  }

  const retry = await attemptSignIn();
  if (!retry.error && retry.data.user) {
    return finishDemoSupabaseSignIn(retry.data.user);
  }

  return {
    ok: false,
    error:
      retry.error?.message ??
      "Demo account was created but sign-in failed. In Supabase → Authentication → Email, turn off “Confirm email”, then try again.",
  };
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();

  if (isSupabaseEnabled()) {
    if (isDemoCredentials(normalized, password)) {
      return signInOrProvisionDemoSupabase();
    }
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });
    if (error) return { ok: false, error: error.message };
    if (!data.user) return { ok: false, error: "Invalid email or password." };
    return { ok: true, user: mapSupabaseUser(data.user) };
  }

  // Local/demo auth is for development only. In production builds it must not
  // be a usable login path — require a real (Supabase) account instead.
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: supabaseRequiredMessage() };
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
  clearLeaderboardCache();
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
