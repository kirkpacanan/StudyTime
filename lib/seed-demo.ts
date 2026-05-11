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

const DEMO_EMAIL = "demo@studytime.app";
const DEMO_PASSWORD = "demo1234";

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
  if (isBootstrapped()) return;

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

  await saveSettings(demoUser.id, { ...DEFAULT_SETTINGS });

  for (let d = 0; d < 7; d++) {
    const sessionsPerDay = Math.floor(randomBetween(1, 3.99));
    for (let i = 0; i < sessionsPerDay; i++) {
      await appendSession(makeSession(demoUser.id, d, i));
    }
  }

  setBootstrapped();
}
