from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import json
import os

FEATURES = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
]

with open(Path(__file__).parent / "means.json", encoding="utf-8") as _mf:
    MEANS = json.load(_mf)

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:4321").split(",")
    if o.strip()
]

app = FastAPI(title="capstone-predict")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


def load_model():
    import pickle

    path = Path(__file__).parent / "model.pkl"
    if not path.exists():
        return None
    with open(path, "rb") as f:
        return pickle.load(f)


model = load_model()


class PatientData(BaseModel):
    Pregnancies: int = Field(ge=0, le=20)
    Glucose: float = Field(ge=0, le=200)
    BloodPressure: float = Field(ge=0, le=140)
    SkinThickness: float = Field(ge=0, le=110)
    Insulin: float = Field(ge=0, le=900)
    BMI: float = Field(ge=10, le=80)
    DiabetesPedigreeFunction: float = Field(ge=0.05, le=2.5)
    Age: int = Field(ge=21, le=100)


def _proba(vec: list[float]) -> float:
    return float(model.predict_proba(np.array([vec]))[0][1])


@app.get("/")
def root():
    return {"service": "capstone-predict", "model_loaded": model is not None}


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/predict")
def predict_risk(data: PatientData):
    if model is None:
        raise HTTPException(status_code=500, detail="Model file not found")

    x = [float(getattr(data, f)) for f in FEATURES]
    base = _proba(x)

    contributions: dict[str, float] = {}
    for i, f in enumerate(FEATURES):
        alt = list(x)
        alt[i] = MEANS[f]
        contributions[f] = round(base - _proba(alt), 5)

    return {"risk_score": base * 100, "contributions": contributions}
