# StudyTime — Focus Prediction (Random Forest)

Offline training + evaluation for the focus-level predictor. The Next.js app does
**not** import scikit-learn; it evaluates the exported JSON model with a tiny
pure-TypeScript Random Forest walker (`lib/ml/focus-prediction.ts`).

## Layout

| Path | Purpose |
| --- | --- |
| `train_focus_model.py` | End-to-end pipeline: data prep → train → evaluate → export |
| `verify_export_parity.py` | Proves the JSON export matches scikit-learn exactly |
| `requirements.txt` | Dev-only Python deps (never shipped to the app) |
| `artifacts/focus_rf_model.joblib` | Canonical trained model (joblib) |
| `artifacts/confusion_matrix.png` | Evaluation 5.2 |
| `artifacts/feature_importance.png` | Evaluation 5.5 |
| `artifacts/metrics.json` | All metrics as JSON |
| `../lib/ml/focus_rf_model.json` | **Runtime model** the app loads (auto-written by training) |

## Setup

```bash
python -m venv .venv && . .venv/Scripts/activate   # optional
pip install -r ml/requirements.txt
```

## Train / retrain

```bash
# Synthetic-seed only (default — current state, no real data yet)
python ml/train_focus_model.py

# Blend real exported sessions with synthetic, or go real-only
python ml/train_focus_model.py --real ml/data/real_sessions.csv --synthetic 60
python ml/train_focus_model.py --real ml/data/real_sessions.csv --synthetic 0
```

Re-running rewrites `lib/ml/focus_rf_model.json`; the app picks it up on the next
server start (the model is read once at module load). Always re-run parity after
retraining:

```bash
python ml/verify_export_parity.py
```

## Exporting real sessions (to grow past the synthetic seed)

`real_sessions.csv` must have these columns (one row per finished session):

```
session_duration,phone_detections,distraction_events,drowsiness_count,
hour_of_day,day_of_week,streak_length,prev_session_focus_score,average_focus
```

You can produce it from Supabase with SQL that mirrors the app's feature logic
(focus_ms→minutes, count `phone_detected`/`eyes_closed_10s`+`head_down_long`
events, `average_focus` as the label source). As real rows accumulate past ~500,
lower `--synthetic` toward `0` so the model learns from genuine behaviour.
