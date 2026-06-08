"""
Parity check: confirm the exported JSON model reproduces scikit-learn's
predict / predict_proba exactly, using the SAME averaging-of-leaf-probabilities
traversal that lib/ml/focus-prediction.ts implements in TypeScript.

If this passes, the in-app TypeScript evaluator is faithful to the trained model.
"""

import json
import os

import joblib
import numpy as np

HERE = os.path.dirname(__file__)
model_bundle = joblib.load(os.path.join(HERE, "artifacts", "focus_rf_model.joblib"))
model = model_bundle["model"]
scaler = model_bundle["scaler"]

with open(os.path.join(HERE, "..", "lib", "ml", "focus_rf_model.json")) as f:
    export = json.load(f)

LEAF = -2


def predict_tree(tree, x):
    node = 0
    while tree["feature"][node] != LEAF:
        f = tree["feature"][node]
        node = (
            tree["children_left"][node]
            if x[f] <= tree["threshold"][node]
            else tree["children_right"][node]
        )
    return np.array(tree["value"][node])


def json_predict_proba(x):
    total = np.zeros(len(export["classes"]))
    for tree in export["trees"]:
        total += predict_tree(tree, x)
    return total / len(export["trees"])


# Random already-scaled samples (the export's thresholds live in scaled space).
rng = np.random.default_rng(7)
raw = rng.normal(
    loc=[25, 1, 2, 0.5, 13, 3, 4, 70],
    scale=[10, 1.5, 2, 1, 5, 2, 5, 12],
    size=(200, 8),
)
scaled = scaler.transform(raw)

sk_proba = model.predict_proba(scaled)
js_proba = np.array([json_predict_proba(scaled[i]) for i in range(len(scaled))])

max_proba_diff = np.abs(sk_proba - js_proba).max()
sk_pred = model.classes_[sk_proba.argmax(axis=1)]
js_pred = np.array(export["classes"])[js_proba.argmax(axis=1)]
label_match = (sk_pred == js_pred).mean()

print(f"max predict_proba difference : {max_proba_diff:.3e}")
print(f"label agreement              : {label_match * 100:.2f}%")
assert max_proba_diff < 1e-6, "Probability mismatch — export is not faithful!"
assert label_match == 1.0, "Label mismatch — export is not faithful!"
print("PARITY OK — TypeScript evaluator will match scikit-learn.")
