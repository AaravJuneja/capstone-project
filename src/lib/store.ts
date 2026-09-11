import {
  FEATURES,
  sliderConfigs,
  type Checkin,
  type Feature,
  type Inputs,
  type Person,
} from "./metrics";

const KEY = "capstone.tracking.v1";

export interface Store {
  persons: Person[];
  checkins: Checkin[];
}

export const emptyStore: Store = { persons: [], checkins: [] };

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore;
    const parsed = JSON.parse(raw) as Store;
    if (!Array.isArray(parsed.persons) || !Array.isArray(parsed.checkins))
      return emptyStore;
    return parsed;
  } catch {
    return emptyStore;
  }
}

export function saveStore(store: Store): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

function clampInputs(inputs: Partial<Record<string, number>>): Inputs | null {
  const out = {} as Inputs;
  for (const f of FEATURES) {
    const v = Number(inputs[f]);
    if (!Number.isFinite(v)) return null;
    const cfg = sliderConfigs[f];
    out[f] = Math.min(cfg.max, Math.max(cfg.min, v));
  }
  return out;
}

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z]/g, "");
}

const headerMap: Record<string, Feature | "date"> = {
  date: "date",
  ...Object.fromEntries(FEATURES.map((f) => [normalizeHeader(f), f] as const)),
};

export interface ParseResult {
  rows: { date: string; inputs: Inputs }[];
  errors: string[];
}

export function parseReportCsv(text: string): ParseResult {
  const errors: string[] = [];
  const rows: { date: string; inputs: Inputs }[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return { rows, errors: ["CSV needs a header row plus at least one data row."] };
  }
  const headers = lines[0].split(",").map((h) => headerMap[normalizeHeader(h)]);
  const dateIdx = headers.indexOf("date");
  if (dateIdx === -1) {
    return { rows, errors: ["Missing a 'date' column (YYYY-MM-DD)."] };
  }
  const missing = FEATURES.filter((f) => !headers.includes(f));
  if (missing.length > 0) {
    return {
      rows,
      errors: [`Missing columns: ${missing.join(", ")}.`],
    };
  }
  lines.slice(1).forEach((line, i) => {
    const cells = line.split(",").map((c) => c.trim());
    const date = cells[dateIdx];
    const d = new Date(`${date ?? ""}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ||
      Number.isNaN(d.getTime()) ||
      d.toISOString().slice(0, 10) !== date
    ) {
      errors.push(`Row ${i + 2}: bad date '${date ?? ""}', expected a real YYYY-MM-DD date. Skipped.`);
      return;
    }
    const partial: Partial<Record<string, number>> = {};
    headers.forEach((h, j) => {
      if (h && h !== "date") partial[h] = Number(cells[j]);
    });
    const inputs = clampInputs(partial);
    if (!inputs) {
      errors.push(`Row ${i + 2}: non-numeric metric value. Skipped.`);
      return;
    }
    rows.push({ date, inputs });
  });
  return { rows, errors };
}

export function exportCsv(checkins: Checkin[]): string {
  const header = ["date", ...FEATURES].join(",");
  const lines = checkins.map((c) =>
    [c.date, ...FEATURES.map((f) => c.inputs[f])].join(","),
  );
  return [header, ...lines].join("\n");
}

export function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const csvTemplate = () =>
  ["date", ...FEATURES].join(",") +
  `\n${today()},0,100,70,20,80,25,0.5,30\n`;
