#!/usr/bin/env node
/**
 * Verifies social RPCs exist on the configured Supabase project.
 * Run: node scripts/check-social-rpc.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* no .env.local */
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable key in .env.local");
  process.exit(1);
}

async function probe(name, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const checks = [
  ["get_public_profile", { p_target: null, p_username: null, p_public_uid: null }],
  ["search_users", { p_query: "st", p_limit: 1 }],
  ["get_my_profile", {}],
];

console.log(`Checking ${url} …\n`);

let ok = true;
for (const [name, body] of checks) {
  const { status, json } = await probe(name, body);
  const missing =
    status === 404 ||
    json?.code === "PGRST202" ||
    /Could not find the function/i.test(json?.message ?? "");
  if (missing) {
    ok = false;
    console.log(`✗ ${name} — NOT FOUND (apply supabase/APPLY_SOCIAL.sql)`);
  } else if (status >= 400 && json?.code !== "PGRST116") {
    // PGRST116 = no rows, fine for empty result
    console.log(`? ${name} — HTTP ${status} ${json?.message ?? ""}`);
  } else {
    console.log(`✓ ${name} — available`);
  }
}

console.log("");
if (ok) {
  console.log("Social RPCs look good.");
} else {
  console.log("Fix: Supabase Dashboard → SQL Editor → paste & run supabase/APPLY_SOCIAL.sql");
  process.exit(1);
}
