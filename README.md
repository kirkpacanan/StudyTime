# StudyTime

**StudyTime** is a minimalistic web prototype for an IoT-style smart study monitoring system: live webcam focus detection (face landmarks + eye openness heuristics), Pomodoro study sessions, and weekly performance reports. Data is stored in **LocalStorage** (no backend).

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS  
- `face-api.js` for browser-side vision  
- Recharts for weekly charts  
- Mock auth (SHA-256 + salt) with a seeded demo account  

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
