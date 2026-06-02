import {
  ACHIEVEMENTS,
  type AchievementId,
} from "./gamification/achievements";
import { grantAchievements, saveXpState } from "./gamification/progression-storage";
import { MAX_LEVEL, totalXpToReachLevel } from "./gamification/ranks";
import { digestHex, randomSalt } from "./password";
import {
  appendSession,
  getUsers,
  isBootstrapped,
  saveSettings,
  saveUsers,
  setBootstrapped,
} from "./storage";
import type { FocusSampleState, StudySession, UserRecord } from "./types";
import { DEFAULT_SETTINGS } from "./types";

export const DEMO_EMAIL = "demo@studytime.app";
export const DEMO_PASSWORD = "demo1234";

export function isDemoCredentials(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD
  );
}

/** Study GOAT — level 50, prestige 0 (matches ranks.ts curve). */
export function demoMaxXpState() {
  return {
    xp: totalXpToReachLevel(MAX_LEVEL),
    level: MAX_LEVEL,
    prestige: 0,
  };
}

const ALL_ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENTS) as AchievementId[];

/** Sync demo to Lv 50 + all achievements when using Supabase. */
export async function seedDemoCloudProfile(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const { isSupabaseEnabled } = await import("./supabase/config");
  if (!isSupabaseEnabled()) return;

  await saveXpState(userId, demoMaxXpState());
  await grantAchievements(userId, ALL_ACHIEVEMENT_IDS);
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makeSession(
  userId: string,
  dayOffset: number,
  index: number,
): StudySession {
  const day = new Date();
  day.setDate(day.getDate() - dayOffset);
  day.setHours(10 + index * 3, 15, 0, 0);

  const focusMs = Math.round(randomBetween(18, 28) * 60 * 1000);
  const breakMs = Math.round(randomBetween(4, 8) * 60 * 1000);
  const avg = randomBetween(62, 92);
  const samples: StudySession["samples"] = [];
  const sampleCount = 40;
  for (let i = 0; i < sampleCount; i++) {
    const noise = randomBetween(-18, 18);
    const score = Math.min(100, Math.max(0, avg + noise));
    let state: FocusSampleState = "drifting";
    if (score >= 70) state = "focused";
    else if (score < 40) state = "distracted";
    samples.push({ t: (i / sampleCount) * focusMs, score, state });
  }
  const focusedRatio =
    (samples.filter((s) => s.state === "focused").length / samples.length) *
    100;
  let distractionEvents = 0;
  let prev = "focused";
  for (const s of samples) {
    if (
      (s.state === "distracted" ||
        s.state === "away" ||
        s.state === "sleeping") &&
      prev !== "distracted" &&
      prev !== "away" &&
      prev !== "sleeping"
    ) {
      distractionEvents++;
    }
    prev = s.state;
  }

  const startedAt = day.toISOString();
  const ended = new Date(day.getTime() + focusMs + breakMs);

  return {
    id: crypto.randomUUID(),
    userId,
    startedAt,
    endedAt: ended.toISOString(),
    focusMs,
    breakMs,
    averageFocus: Math.round(avg),
    focusedRatio: Math.round(focusedRatio),
    distractionEvents,
    samples,
  };
}

export async function seedDemoData(): Promise<void> {
  if (typeof window === "undefined") return;
  const { isSupabaseEnabled } = await import("./supabase/config");
  if (isSupabaseEnabled()) return;

  // ── 1. Ensure demo user exists ─────────────────────────────────────────────
  const users = getUsers();
  let demoUser: UserRecord | undefined = users.find(
    (u) => u.email === DEMO_EMAIL,
  );

  if (!demoUser) {
    const salt = randomSalt();
    const passwordHash = await digestHex(DEMO_PASSWORD + salt);
    demoUser = {
      id: crypto.randomUUID(),
      email: DEMO_EMAIL,
      name: "Demo Student",
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
    };
    users.push(demoUser);
    saveUsers(users);
  }

  // ── 2. Always keep demo account at max level, prestige 0 ─────────────────
  // The demo showcases the full rank progression (Study GOAT, Lv 50) with
  // no prestige so the prestige feature can be demonstrated fresh each time.
  // Also fires when the user tests prestige (level drops to 1 or prestige > 0),
  // so the account is always clean on the next startup.
  const xpKey = `studytime_xp_${demoUser.id}`;
  const stored = localStorage.getItem(xpKey);
  const storedState = stored
    ? (JSON.parse(stored) as { level?: number; prestige?: number })
    : null;
  const currentLevel = storedState?.level ?? 1;
  const currentPrestige = storedState?.prestige ?? 0;
  if (currentLevel < MAX_LEVEL || currentPrestige !== 0) {
    localStorage.setItem(xpKey, JSON.stringify(demoMaxXpState()));
  }

  // ── 3. Unlock all achievements ─────────────────────────────────────────────
  const achievementsKey = `studytime_achievements_${demoUser.id}`;
  const storedAchievements: string[] = JSON.parse(
    localStorage.getItem(achievementsKey) ?? "[]",
  );
  if (storedAchievements.length < ALL_ACHIEVEMENT_IDS.length) {
    localStorage.setItem(
      achievementsKey,
      JSON.stringify([...ALL_ACHIEVEMENT_IDS]),
    );
  }

  // ── 4. Seed study sessions once ────────────────────────────────────────────
  if (isBootstrapped()) return;

  await saveSettings(demoUser.id, { ...DEFAULT_SETTINGS });

  for (let d = 0; d < 7; d++) {
    const sessionsPerDay = Math.floor(randomBetween(1, 3.99));
    for (let i = 0; i < sessionsPerDay; i++) {
      await appendSession(makeSession(demoUser.id, d, i));
    }
  }

  setBootstrapped();
}
