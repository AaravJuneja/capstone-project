export const FEATURES = [
  "Pregnancies",
  "Glucose",
  "BloodPressure",
  "SkinThickness",
  "Insulin",
  "BMI",
  "DiabetesPedigreeFunction",
  "Age",
] as const;

export type Feature = (typeof FEATURES)[number];
export type Inputs = Record<Feature, number>;

export interface SliderConfig {
  min: number;
  max: number;
  step: number;
  unit: string;
  normal: string;
}

export const sliderConfigs: Record<Feature, SliderConfig> = {
  Pregnancies: { min: 0, max: 20, step: 1, unit: "", normal: "" },
  Glucose: {
    min: 0,
    max: 200,
    step: 1,
    unit: "mg/dL",
    normal: "Normal: < 140 mg/dL",
  },
  BloodPressure: {
    min: 0,
    max: 140,
    step: 1,
    unit: "mm Hg",
    normal: "Normal (Diastolic): 60-80 mm Hg",
  },
  SkinThickness: {
    min: 0,
    max: 110,
    step: 1,
    unit: "mm",
    normal: "Typical (Triceps): 10-30 mm",
  },
  Insulin: {
    min: 0,
    max: 900,
    step: 1,
    unit: "μU/ml",
    normal: "Normal: 16-166 μU/ml",
  },
  BMI: {
    min: 10,
    max: 80,
    step: 0.1,
    unit: "kg/m²",
    normal: "Normal: 18.5-24.9 kg/m²",
  },
  DiabetesPedigreeFunction: {
    min: 0.05,
    max: 2.5,
    step: 0.01,
    unit: "",
    normal: "Genetic risk score",
  },
  Age: { min: 21, max: 100, step: 1, unit: "years", normal: "" },
};

export const defaultInputs: Inputs = {
  Pregnancies: 0,
  Glucose: 100,
  BloodPressure: 70,
  SkinThickness: 20,
  Insulin: 80,
  BMI: 25,
  DiabetesPedigreeFunction: 0.5,
  Age: 30,
};

export interface Person {
  id: string;
  name: string;
  createdAt: string;
}

export interface Checkin {
  id: string;
  personId: string;
  date: string;
  inputs: Inputs;
  risk: number | null;
  bandHits: number;
  distGap: number;
}

export type Status = "safe" | "watch" | "warning";
