// StudyTime rate-limit Edge Function (Supabase Deno runtime).
//
// Sliding-window limiter for abuse-prone social actions (user search, friend
// requests). Backed by Upstash Redis REST. Deploy with:
//   supabase functions deploy rate-limit
// and set secrets:
//   supabase secrets set UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=...
//
// The client calls this before invoking the corresponding RPC, passing the
// user's JWT so we key the limit on auth.uid().

import { createClient } from "jsr:@supabase/supabase-js@2";

const REDIS_URL = Deno.env.get("UPSTASH_REDIS_REST_URL")!;
const REDIS_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// action -> [maxRequests, windowSeconds]
const LIMITS: Record<string, [number, number]> = {
  search_users: [30, 60],
  send_friend_request: [20, 3600],
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function redis(command: string[]): Promise<unknown> {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const json = await res.json();
  return json.result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { action } = await req.json();
    const limit = LIMITS[action];
    if (!limit) {
      return json({ allowed: false, error: "Unknown action" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ allowed: false, error: "Unauthorized" }, 401);

    const [max, windowSec] = limit;
    const key = `rl:${action}:${user.id}`;
    const count = Number((await redis(["INCR", key])) ?? 0);
    if (count === 1) await redis(["EXPIRE", key, String(windowSec)]);

    const allowed = count <= max;
    return json({ allowed, remaining: Math.max(0, max - count) }, allowed ? 200 : 429);
  } catch (err) {
    return json({ allowed: false, error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
