# Diabetes Risk Assessment: Class XII AI Capstone

CBSE Artificial Intelligence (Code 843), Class XII capstone project.
SDG aligned: **SDG 3: Good Health and Wellbeing**.

## Problem statement

How can we help individuals and families find a way to spot early signs of
diabetes risk from routine health numbers so that they can act months or
years before complications set in.

## Users

Individuals tracking their own health and families tracking elders or
dependents. They need a risk signal they can understand, a reason behind
the score, personal history over time instead of a one time verdict and
guidance they can act on.

## Solution

A web app with four parts:

| Part | Route | What it does |
|---|---|---|
| Assess | `/` | Sliders for 8 health metrics, live ML risk score, per feature explanation chart and AI health coach action plan |
| Track | `/` My Tracking tab | Per person profiles, routine checkins, trajectory chart against the confirmed diabetic zone with report CSV upload and export |
| Analysis | `/analysis` | Full Data Science Methodology walkthrough with charts computed from our dataset |
| Story | `/story` | Data storytelling narrative of the findings |

## Design: user journey

1. Visitor opens Assess and moves sliders to match a recent health report.
2. Risk score updates live with a bar chart showing which metrics push risk
   up or down.
3. Visitor clicks Generate Action Plan for 3 tailored lifestyle tips.
4. Visitor creates a profile under My Tracking and saves the reading as a
   dated checkin, or uploads past readings as CSV.
5. The trajectory chart flags On track, Early sign or Bad zone as new
   readings drift toward the diabetic zone.

## Data

8 numeric health inputs plus Outcome label (2768 rows, 952 diabetic, 1816
healthy). Personal checkins stay in the visitor browser only and are
exportable as CSV. No names are required. Zeros in Glucose,
BloodPressure, SkinThickness, Insulin and BMI are missing value
placeholders, not real measurements.

## Modelling

Binary classification. Split 1854 train and 914 test. Deployed model is a
Random Forest of 100 trees at depth 5, chosen over a higher scoring
Decision Tree that memorized the split and an SVM that underfit
diabetics. Each prediction ships with per feature contributions and the
Analysis page shows accuracy, confusion matrices, precision, recall and
F1 per class.

## Prototype tools

Astro islands with React and Tailwind on a Cloudflare Worker, Random
Forest on FastAPI, OpenRouter free models for the coach.

## Deployment

| Piece | Status | Notes |
|---|---|---|
| Predict API | Current | FastAPI scoring service on Render at https://capstone-project-l46z.onrender.com |
| Render service | Current | Slim FastAPI build without SHAP, with health check |

## Disclaimer

For educational purposes only. This tool is not a substitute for
professional medical advice.
