import json
from pathlib import Path

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

root = Path(__file__).resolve().parent.parent
df = pd.read_csv(root / "legacy" / "Healthcare-Diabetes.csv").copy()

num_col = ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
           'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age', 'Outcome']
no_outlier = df
for i in num_col:
    lower_limit = df[i].quantile(0.5)
    upper_limit = df[i].quantile(0.95)
    no_outlier[i] = no_outlier[i].clip(lower_limit, upper_limit)

df = df.drop(['Id'], axis=1)
X = df.iloc[:, :-1]
y = df.iloc[:, -1]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.33, random_state=42)


def entry(name, model, params=None, full=True):
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    out = {"name": name, "accuracy": round(float(accuracy_score(y_test, pred)), 4)}
    if params:
        out["params"] = params
    if full:
        out["cm"] = confusion_matrix(y_test, pred).tolist()
        rep = classification_report(y_test, pred, output_dict=True)
        out["report"] = {
            k: {
                "precision": round(rep[k]["precision"], 2),
                "recall": round(rep[k]["recall"], 2),
                "f1": round(rep[k]["f1-score"], 2),
                "support": int(rep[k]["support"]),
            }
            for k in ("0", "1")
        }
    else:
        out["cm"] = None
        out["report"] = None
    return out


doc = {
    "source": "legacy/Diabetes_code.ipynb replication (test_size=0.33, random_state=42)",
    "split": {"test_size": 0.33, "random_state": 42, "train": len(X_train), "test": len(X_test)},
    "deployed": "Random Forest",
    "deploy_reason": "Decision Tree scores higher on the test split but a single unpruned tree overfits tabular health data; the forest (100 trees, max depth 5) generalises better and gives calibrated predict_proba risk scores instead of hard labels.",
    "models": [
        entry("SVM (linear)", SVC(kernel='linear', random_state=42)),
        entry("Decision Tree", DecisionTreeClassifier(random_state=42)),
        entry("Random Forest", RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42),
              params="n_estimators=100, max_depth=5, random_state=42", full=False),
    ],
}

target = root / "src" / "data" / "model-metrics.json"
target.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
print(f"train={len(X_train)} test={len(X_test)}")
for m in doc["models"]:
    print(m["name"], m["accuracy"])
print(f"wrote {target}")
