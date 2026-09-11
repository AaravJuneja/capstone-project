// Offline one-time stats builder. Reads the project CSV from legacy/ and
// writes baked JSON used by the frontend (analysis pages + bad-region).
// Run: bun run data
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = join(root, "legacy", "Healthcare-Diabetes.csv");
const outDir = join(root, "src", "data");

const FEATURES = [
  "Pregnancies",
  "Glucose",
  "BloodPressure",
  "SkinThickness",
  "Insulin",
  "BMI",
  "DiabetesPedigreeFunction",
  "Age",
] as const;

type Feature = (typeof FEATURES)[number];

const raw = await Bun.file(csvPath).text();
const lines = raw.trim().split("\n");
const header = lines[0].split(",");
const idx: Record<string, number> = Object.fromEntries(
  header.map((h, i) => [h.trim(), i]),
);

type Row = Record<Feature | "Outcome", number>;
const rows: Row[] = lines.slice(1).map((line) => {
  const cells = line.split(",");
  const get = (k: string) => Number(cells[idx[k]]);
  return {
    Pregnancies: get("Pregnancies"),
    Glucose: get("Glucose"),
    BloodPressure: get("BloodPressure"),
    SkinThickness: get("SkinThickness"),
    Insulin: get("Insulin"),
    BMI: get("BMI"),
    DiabetesPedigreeFunction: get("DiabetesPedigreeFunction"),
    Age: get("Age"),
    Outcome: get("Outcome"),
  };
});

const round2 = (n: number) => Math.round(n * 100) / 100;

function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base] + (sorted[base + 1] !== undefined ? rest * (sorted[base + 1] - sorted[base]) : 0);
}

function stats(vals: number[]) {
  const sorted = [...vals].sort((a, b) => a - b);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance =
    vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  return {
    n: vals.length,
    mean: round2(mean),
    std: round2(Math.sqrt(variance)),
    min: sorted[0],
    p25: round2(quantile(sorted, 0.25)),
    median: round2(quantile(sorted, 0.5)),
    p75: round2(quantile(sorted, 0.75)),
    max: sorted[sorted.length - 1],
  };
}

function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

const diabetic = rows.filter((r) => r.Outcome === 1);
const healthy = rows.filter((r) => r.Outcome === 0);
const outcomes = rows.map((r) => r.Outcome);

const features: Record<string, unknown> = {};
const badRegionFeatures: Record<string, unknown> = {};
const diabeticCentroid: number[] = [];
const healthyCentroid: number[] = [];
const stds: number[] = [];

for (const f of FEATURES) {
  const all = rows.map((r) => r[f]);
  const d = diabetic.map((r) => r[f]);
  const h = healthy.map((r) => r[f]);
  const sAll = stats(all);
  const sD = stats(d);
  const sH = stats(h);
  features[f] = {
    overall: sAll,
    diabetic: sD,
    healthy: sH,
    correlation_with_outcome: round2(pearson(all, outcomes)),
  };
  // Bad region entry: value at/above the confirmed-diabetic median sits
  // where at least half of diabetic cases sit (or worse). Validated on the
  // full CSV: median-based counting + distance gap separates the Outcome
  // split (diabetic warn ~63% / healthy warn ~23% without model risk).
  badRegionFeatures[f] = {
    bad_min: sD.median,
    diabetic_median: sD.median,
    diabetic_p75: sD.p75,
    diabetic_mean: sD.mean,
    healthy_median: sH.median,
  };
  diabeticCentroid.push(sD.mean);
  healthyCentroid.push(sH.mean);
  stds.push(sAll.std || 1);
}

const datasetStats = {
  source: "legacy/Healthcare-Diabetes.csv",
  rows: rows.length,
  diabetic: diabetic.length,
  healthy: healthy.length,
  diabetic_rate: round2(diabetic.length / rows.length),
  features,
};

const badRegion = {
  source: "confirmed-diabetes split (Outcome==1) of legacy/Healthcare-Diabetes.csv",
  n_diabetic: diabetic.length,
  n_healthy: healthy.length,
  features: badRegionFeatures,
  centroids: {
    diabetic: diabeticCentroid.map(round2),
    healthy: healthyCentroid.map(round2),
    stds: stds.map(round2),
    order: [...FEATURES],
  },
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "dataset-stats.json"), JSON.stringify(datasetStats, null, 2) + "\n");
writeFileSync(join(outDir, "bad-region.json"), JSON.stringify(badRegion, null, 2) + "\n");

console.log(`rows=${rows.length} diabetic=${diabetic.length} healthy=${healthy.length}`);
console.log("wrote src/data/dataset-stats.json + src/data/bad-region.json");
