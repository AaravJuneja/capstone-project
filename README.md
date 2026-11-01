# Diabetes risk assessment

Class XII CBSE Artificial Intelligence capstone (Code 843), aligned with SDG 3. The app estimates diabetes risk from eight health metrics and shows which inputs affect the score. It also includes personal tracking, CSV import/export, an analysis page, and an optional AI health coach.

## Data and model

The dataset has 2,768 rows: 952 diabetic and 1,816 healthy records. The app uses a 100-tree Random Forest with depth 5, trained on 1,854 rows and tested on 914. Zeros in Glucose, BloodPressure, SkinThickness, Insulin, and BMI are treated as missing-value placeholders.

Personal check-ins stay in the browser and can be exported as CSV. No name is required.

## Stack

Astro, React, and Tailwind CSS on Cloudflare Workers; a FastAPI scoring service on Render; OpenRouter for the optional coach.

## Disclaimer

For education only. This app does not provide medical advice or a diagnosis.
