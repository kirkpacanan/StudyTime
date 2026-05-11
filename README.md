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

## Supabase (optional)

1. Create a project at [supabase.com](https://supabase.com/) and open **SQL Editor**.
2. Paste and run the migration in **`supabase/migrations/20240512000000_studytime_init.sql`** (tables, RLS, and `on_auth_user_created` trigger for `profiles` + default `user_settings`).
3. In **Project Settings → API**, copy the **Project URL** and **anon public** key.
4. Add **`/.env.local`** (see **`.env.example`**) with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then restart `npm run dev`.
5. Under **Authentication → Providers → Email**, consider turning **Confirm email** off while developing so sign-up can sign in immediately.

When these variables are set, the app uses **Supabase Auth** instead of local mock users, and reads/writes sessions and settings to Postgres. **Gamification** snapshots (leaderboard ranks, achievements) still use **localStorage** unless you extend the schema.

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
