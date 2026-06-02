# StudyTime

**StudyTime** is a minimalistic web prototype for an IoT-style smart study monitoring system: live webcam focus detection (face landmarks + eye openness heuristics), Pomodoro study sessions, and weekly performance reports. By default data lives in **LocalStorage** with mock auth; you can optionally connect **[Supabase](https://supabase.com/)** for cloud auth and synced sessions/settings.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS  
- `face-api.js` for browser-side vision  
- Recharts for weekly charts  
- Mock auth (SHA-256 + salt) with a seeded demo account, or **Supabase Auth** when env vars are set  
- Optional **Supabase Postgres** for `profiles`, `user_settings`, and `study_sessions`  

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo login

After the first load, a demo account is seeded:

- **Email:** `demo@studytime.app`  
- **Password:** `demo1234`  

The demo user includes sample sessions for the last 7 days so **Reports** is populated immediately.

## Supabase (required for cloud + social features)

1. Create a project at [supabase.com](https://supabase.com/) and open **SQL Editor**.
2. Run every migration in **`supabase/migrations/`** in filename order:
   - `20240512000000_studytime_init.sql` — profiles, settings, sessions, RLS, signup trigger
   - `20240512001000_studytime_rls_trigger_fix.sql` — signup trigger fix
   - `20240512002000_leaderboard_rpc.sql` — leaderboard RPCs
   - `20240512003000_leaderboard_all_profiles.sql` — include all profiles
   - `20240513000000_gamification.sql` — XP, ranks, cosmetics, achievements, quests, streaks, study buddies
   - `20240601000000_social_identity.sql` — usernames, public UIDs, privacy, profile RPCs
   - `20240601001000_friends.sql` — friend requests + friends graph and RPCs
   - `20240601002000_presence.sql` — `user_presence` + heartbeat/presence RPCs
   - `20240601003000_activity_feed.sql` — activity events, feed RPC, notifications
   - `20240601004000_scale.sql` — materialized all-time leaderboard, session summary view, retention helper
3. In **Project Settings → API**, copy the **Project URL** and **anon public** key.
4. Add **`/.env.local`** (see **`.env.example`**) with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then restart `npm run dev`.
5. Under **Authentication → Providers → Email**, consider turning **Confirm email** off while developing so sign-up can sign in immediately.
6. Under **Database → Replication**, enable Realtime for `user_presence`, `notifications`, and `activity_events` (the migrations also add them to the `supabase_realtime` publication automatically).

When these variables are set, the app uses **Supabase Auth** (cookie session, readable by Next.js middleware) and stores sessions, settings, gamification, and the full social graph in Postgres.

## Social features

- **Identity:** every user gets a short public UID (e.g. `ST-A7K9M2`) and can claim a unique `@username`. Both are shown on the profile and used for search and shareable `/u/<handle>` links.
- **Public profiles:** `/u/[handle]` resolves by username, public UID, or user id, honoring per-user **privacy** (`public` / `friends` / `private`) configured in **Settings → Privacy & visibility**.
- **Friends:** send/accept/decline requests, remove or block users, all via SECURITY DEFINER RPCs. The **Friends** page has Friends and Requests tabs plus a search modal.
- **Study Buddy** (parallel to friends): a 1:1 pairing that grants a +20% XP bonus on days you both study. Pick a friend in the buddy card, or paste a raw user id (advanced).
- **Presence:** a heartbeat marks you `online`/`studying`; friends see live status (green dot, “N studying” in the topbar) subject to your `showStudyStatus` setting.
- **Activity feed:** `/feed` shows friends' completed sessions, streak milestones, achievements, and level-ups, with a notification bell for friend requests.

All social features require Supabase; without it the app runs in local/demo mode and these views show a sign-in prompt.

## Production deployment checklist

1. Host on Vercel; set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (never an `sb_secret_` key in `NEXT_PUBLIC_*`).
2. Apply all migrations above, in order.
3. Enable Realtime for `user_presence`, `notifications`, `activity_events`.
4. Schedule `select public.refresh_leaderboards();` every ~10 min (pg_cron, or a Vercel/Edge cron job) to keep the cached all-time leaderboard fresh.
5. Optionally deploy the **`supabase/functions/rate-limit`** Edge Function and set the Upstash Redis secrets to throttle search / friend requests.
6. Serve over HTTPS (required for webcam) and confirm face-api weights exist under `public/models/`.
7. In production builds the local demo login is disabled — only real Supabase accounts can sign in.

**Sign up** is disabled until Supabase is configured (valid `https://…supabase.co` URL + anon key), so you do not accumulate local-only accounts by mistake. **Sign in** without Supabase still works for the seeded **demo** account in local-only mode.

## Face-API model weights (one-time)

Download the following folders from the official `face-api.js` weights repository into **`public/models/`** so the app can load:

- `tiny_face_detector_model-*`  
- `face_landmark_68_model-*`  
- `face_expression_model-*`  

**Source (GitHub):**  
[https://github.com/justadudewhohacks/face-api.js/tree/master/weights](https://github.com/justadudewhohacks/face-api.js/tree/master/weights)

Example (run from project root — requires network):

```bash
mkdir -p public/models
cd public/models
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-shard1
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-weights_manifest.json
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-shard1
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_expression_model-weights_manifest.json
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_expression_model-shard1
```

> Webcam features require **HTTPS** or **localhost** and browser camera permission.

## Scripts

| Command        | Description           |
|----------------|-----------------------|
| `npm run dev`  | Development server    |
| `npm run build`| Production build      |
| `npm run start`| Run production server |
| `npm run lint` | ESLint                |

## Notes on “accuracy”

Focus scores depend on lighting, camera quality, and thresholds in **Settings**. This prototype is suitable for demos and UX validation—not clinical or high-stakes assessment.

## Theme

UI colors emphasize calm **blue** with supportive **green**, **yellow**, and soft **coral red** accents for low-stress, study-friendly visuals.

## License

Private / educational use unless you add a license.
