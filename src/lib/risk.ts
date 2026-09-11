import badRegion from "../data/bad-region.json";
import { FEATURES, type Checkin, type Feature, type Inputs, type Status } from "./metrics";

type BadFeature = {
  bad_min: number;
  diabetic_median: number;
  diabetic_p75: number;
  diabetic_mean: number;
  healthy_median: number;
};

const badFeatures = badRegion.features as Record<Feature, BadFeature>;
const diabeticCentroid = badRegion.centroids.diabetic as number[];
const healthyCentroid = badRegion.centroids.healthy as number[];
const stds = badRegion.centroids.stds as number[];

export function bandHits(inputs: Inputs): { count: number; hits: Feature[] } {
  const hits = FEATURES.filter((f) => inputs[f] >= badFeatures[f].bad_min);
  return { count: hits.length, hits };
}

export function distGap(inputs: Inputs): number {
  let dD = 0;
  let dH = 0;
  FEATURES.forEach((f, i) => {
    const z = inputs[f] / (stds[i] || 1);
    dD += (z - diabeticCentroid[i] / (stds[i] || 1)) ** 2;
    dH += (z - healthyCentroid[i] / (stds[i] || 1)) ** 2;
  });
  const gap = Math.sqrt(dD) - Math.sqrt(dH);
  return Math.round(gap * 100) / 100;
}

export function assess(
  risk: number | null,
  hits: number,
  gap: number,
): Status {
  if (
    (risk !== null && risk >= 60) ||
    (hits >= 4 && gap <= 0) ||
    gap <= -0.9
  )
    return "warning";
  if ((risk !== null && risk >= 35) || hits >= 3 || gap <= 0) return "watch";
  return "safe";
}

export function riskSlope(risks: (number | null)[]): number | null {
  const pts = risks.filter((r): r is number => r !== null).slice(-5);
  if (pts.length < 2) return null;
  const n = pts.length;
  const xs = pts.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = pts.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (pts[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (!den) return 0;
  return Math.round((num / den) * 10) / 10;
}

export const statusLabel: Record<Status, string> = {
  safe: "On track",
  watch: "Early sign",
  warning: "Bad zone",
};

export const statusClass: Record<Status, string> = {
  safe: "bg-green-100 text-green-800",
  watch: "bg-yellow-100 text-yellow-800",
  warning: "bg-red-100 text-red-800",
};

const moveThreshold: Record<Feature, number> = {
  Pregnancies: 1,
  Glucose: 8,
  BloodPressure: 5,
  SkinThickness: 5,
  Insulin: 15,
  BMI: 1,
  DiabetesPedigreeFunction: 0.1,
  Age: 1,
};

const neat = (n: number) => String(Math.round(n * 10) / 10);

export function summarizeHistory(checkins: Checkin[]): string | null {
  const sorted = [...checkins].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const scored = sorted.filter((c) => c.risk !== null);
  const parts = [
    `Profile has ${sorted.length} checkin${sorted.length === 1 ? "" : "s"} from ${first.date} to ${last.date}.`,
  ];
  if (scored.length >= 2) {
    parts.push(
      `Risk moved from ${neat(scored[0].risk as number)} to ${neat(scored[scored.length - 1].risk as number)}.`,
    );
  } else {
    parts.push(`No scored risk trend yet.`);
  }
  parts.push(
    `Zone hits moved from ${first.bandHits} to ${last.bandHits} of 8.`,
  );
  const movers: string[] = [];
  for (const f of FEATURES) {
    const delta = last.inputs[f] - first.inputs[f];
    if (Math.abs(delta) >= moveThreshold[f]) {
      movers.push(`${f} moved from ${neat(first.inputs[f])} to ${neat(last.inputs[f])}`);
    }
  }
  parts.push(
    movers.length > 0
      ? movers.join(". ") + "."
      : `Other metrics stayed near start values.`,
  );
  return parts.join(" ");
}
