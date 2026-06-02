/**
 * One-off: seed demo@studytime.app sessions in Supabase (same data as seedDemoCloudSessions).
 * Usage: node scripts/seed-demo-supabase.mjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + publishable/anon key.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const DEMO_EMAIL = "demo@studytime.app";
const DEMO_PASSWORD = "demo1234";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* ignore */
  }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function makeSession(userId, dayOffset, index) {
  const day = new Date();
  day.setDate(day.getDate() - dayOffset);
  day.setHours(10 + index * 3, 15, 0, 0);
  const focusMs = Math.round(randomBetween(18, 28) * 60 * 1000);
  const breakMs = Math.round(randomBetween(4, 8) * 60 * 1000);
  const avg = randomBetween(62, 92);
  const sampleCount = 40;
  const samples = [];
  for (let i = 0; i < sampleCount; i++) {
    const score = Math.min(100, Math.max(0, avg + randomBetween(-18, 18)));
    let state = "drifting";
    if (score >= 70) state = "focused";
    else if (score < 40) state = "distracted";
    samples.push({ t: (i / sampleCount) * focusMs, score, state });
  }
  const focusedRatio = Math.round(
    (samples.filter((s) => s.state === "focused").length / samples.length) * 100,
  );
  const startedAt = day.toISOString();
  const ended = new Date(day.getTime() + focusMs + breakMs);
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    started_at: startedAt,
    ended_at: ended.toISOString(),
    focus_ms: focusMs,
    break_ms: breakMs,
    average_focus: Math.round(avg),
    focused_ratio: focusedRatio,
    distraction_events: Math.floor(randomBetween(0, 4)),
    samples,
    events: null,
  };
}

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);
const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
});
if (signErr) {
  console.error("Sign-in failed:", signErr.message);
  process.exit(1);
}
const userId = signIn.user.id;

const { count } = await supabase
  .from("study_sessions")
  .select("*", { count: "exact", head: true })
  .eq("user_id", userId);
if ((count ?? 0) > 0) {
  console.log(`Demo user already has ${count} sessions — skipping.`);
  process.exit(0);
}

const rows = [];
for (let d = 0; d < 7; d++) {
  const n = Math.floor(randomBetween(1, 3.99));
  for (let i = 0; i < n; i++) rows.push(makeSession(userId, d, i));
}

const { error: insErr } = await supabase.from("study_sessions").insert(rows);
if (insErr) {
  console.error("Insert failed:", insErr.message);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
await supabase.from("streaks").upsert({
  user_id: userId,
  current_streak: 7,
  longest_streak: 7,
  last_study_date: today,
  freeze_tokens: 0,
  claimed_milestones: [],
});

console.log(`Seeded ${rows.length} study sessions for demo user ${userId}`);
