import { NextResponse } from "next/server";
import { derivePrediction, type SessionInput } from "@/lib/ml/focus-prediction";

// The model JSON is ~2.4 MB and uses Node APIs at parse time — pin to the Node
// runtime (not edge). The module-scoped model load means it is parsed once per
// server instance and reused for every request (warm in-process inference).
export const runtime = "nodejs";

/** Hard cap so a malicious client can't push an unbounded payload through. */
const MAX_SESSIONS = 2000;

const ALLOWED_EVENT_TYPES = new Set([
  "phone_detected",
  "look_away_long",
  "head_down_long",
  "eyes_closed_10s",
  "alarm_started",
  "alarm_stopped",
]);

/** Validate + coerce one raw item into a trusted SessionInput (defensive parsing). */
function parseSession(raw: unknown): SessionInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.startedAt !== "string") return null;
  if (typeof r.focusMs !== "number" || !Number.isFinite(r.focusMs)) return null;
  if (typeof r.averageFocus !== "number" || !Number.isFinite(r.averageFocus)) {
    return null;
  }
  if (
    typeof r.distractionEvents !== "number" ||
    !Number.isFinite(r.distractionEvents)
  ) {
    return null;
  }

  let events: { type: string }[] | null = null;
  if (Array.isArray(r.events)) {
    events = r.events
      .map((e) =>
        e && typeof (e as { type?: unknown }).type === "string"
          ? { type: (e as { type: string }).type }
          : null,
      )
      .filter(
        (e): e is { type: string } => e !== null && ALLOWED_EVENT_TYPES.has(e.type),
      );
  }

  return {
    startedAt: r.startedAt,
    focusMs: r.focusMs,
    averageFocus: r.averageFocus,
    distractionEvents: r.distractionEvents,
    events,
  };
}

/**
 * POST { sessions: SessionInput[] } -> focus prediction.
 *
 * Core contract (per the brief): { predictedFocus, confidence }. We extend it
 * with the card fields (distractionRisk, recommendation, topFactors); the core
 * pair remains a strict subset for any consumer that only needs it.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawSessions = (body as { sessions?: unknown })?.sessions;
  if (!Array.isArray(rawSessions)) {
    return NextResponse.json(
      { error: "`sessions` must be an array" },
      { status: 400 },
    );
  }
  if (rawSessions.length > MAX_SESSIONS) {
    return NextResponse.json(
      { error: `Too many sessions (max ${MAX_SESSIONS})` },
      { status: 413 },
    );
  }

  const sessions: SessionInput[] = [];
  for (const raw of rawSessions) {
    const parsed = parseSession(raw);
    if (parsed) sessions.push(parsed);
  }

  const prediction = derivePrediction(sessions);
  if (!prediction) {
    return NextResponse.json(
      { error: "Not enough session history to predict" },
      { status: 422 },
    );
  }

  return NextResponse.json(prediction);
}
