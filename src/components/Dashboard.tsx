import { useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  Baby,
  BrainCircuit,
  Cake,
  Dna,
  Droplets,
  HeartPulse,
  RotateCcw,
  Ruler,
  Scale,
  Syringe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Tracking from "./Tracking";
import { summarizeHistory } from "../lib/risk";
import { loadSelected, loadStore } from "../lib/store";

const API_URL =
  import.meta.env.PUBLIC_API_URL ??
  "https://ai-capstone-backend-d09i.onrender.com";

const FETCH_TIMEOUT_MS = 20000;

import {
  defaultInputs,
  sliderConfigs,
  type Feature,
  type Inputs,
} from "../lib/metrics";

const metricIcons: Record<Feature, LucideIcon> = {
  Pregnancies: Baby,
  Glucose: Droplets,
  BloodPressure: HeartPulse,
  SkinThickness: Ruler,
  Insulin: Syringe,
  BMI: Scale,
  DiabetesPedigreeFunction: Dna,
  Age: Cake,
};

const displayName = (key: string) =>
  key.replace(/([a-z])([A-Z])/g, "$1 $2");

function riskColor(value: number | null): string {
  if (value === null) return "#cbd5e1";
  if (value < 35) return "#22c55e";
  if (value < 60) return "#eab308";
  return "#ef4444";
}

function riskLabel(value: number | null): string {
  if (value === null) return "Waiting for score";
  if (value < 35) return "Low";
  if (value < 60) return "Elevated";
  return "High";
}

function Gauge({ value }: { value: number | null }) {
  const frac =
    value === null ? 0 : Math.min(100, Math.max(0, value)) / 100;
  const color = riskColor(value);
  return (
    <div className="relative w-44 shrink-0">
      <svg viewBox="0 0 180 100" className="w-full">
        <path
          d="M 10 90 A 80 80 0 0 1 170 90"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 10 90 A 80 80 0 0 1 170 90"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${frac * 100} 100`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end">
        <span className="text-3xl font-bold" style={{ color }}>
          {value !== null ? `${value.toFixed(1)}%` : "--%"}
        </span>
        <span className="text-xs font-medium text-gray-500">
          {riskLabel(value)}
        </span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [formData, setFormData] = useState<Inputs>(defaultInputs);

  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [shapData, setShapData] = useState<{ feature: string; impact: number }[]>(
    [],
  );
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [coachAdvice, setCoachAdvice] = useState<string>("");
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [tab, setTab] = useState<"assess" | "track">("assess");
  const [coachBasis, setCoachBasis] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runPredict = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let signal: AbortSignal = controller.signal;
    try {
      signal = AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(FETCH_TIMEOUT_MS),
      ]);
    } catch {
      signal = controller.signal;
    }
    setPredicting(true);
    setPredictError(null);
    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        signal,
      });
      if (!res.ok) throw new Error(`predict failed: ${res.status}`);
      const data = await res.json();
      if (data.risk_score !== undefined) {
        setRiskScore(data.risk_score);
        const formatted = Object.entries(
          (data.contributions ?? data.shap_values ?? {}) as Record<
            string,
            unknown
          >,
        ).map(([key, val]) => ({
          feature: key,
          impact: Number(val),
        }));
        setShapData(formatted);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof DOMException && err.name === "TimeoutError") {
        setPredictError(
          "The scoring service is waking up. First visit can take a minute.",
        );
      } else {
        console.error("Failed to fetch prediction", err);
        setPredictError("Could not reach the scoring service.");
      }
    } finally {
      if (abortRef.current === controller) setPredicting(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void runPredict();
    }, 500);
    return () => {
      clearTimeout(timeoutId);
      abortRef.current?.abort();
    };
  }, [formData]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: parseFloat(e.target.value) });
  };

  const fetchAiCoach = async () => {
    if (riskScore === null) return;
    setLoadingCoach(true);
    setCoachBasis(null);
    let trend: string | undefined;
    try {
      const store = loadStore();
      const pid = loadSelected();
      const person = store.persons.find((p) => p.id === pid);
      const mine = pid
        ? store.checkins.filter((c) => c.personId === pid)
        : [];
      const summary = summarizeHistory(mine);
      if (person && summary) {
        trend = summary;
        setCoachBasis(
          `Advice uses ${mine.length} past checkins from ${person.name}.`,
        );
      }
    } catch {
      trend = undefined;
    }
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient: formData, risk_score: riskScore, trend }),
      });
      if (!res.ok) throw new Error(`coach failed: ${res.status}`);
      const data = await res.json();
      setCoachAdvice(data.coach_advice ?? "");
    } catch (err) {
      console.error(err);
    }
    setLoadingCoach(false);
  };

  return (
    <div className="p-8">
      <header className="mb-8 flex items-center gap-4">
        <div className="bg-brand text-white rounded-2xl p-3">
          <Activity size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Diabetes Risk Assessment
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            For education only. This tool is not medical advice.
          </p>
        </div>
      </header>

      <div className="flex gap-2 mb-8">
        {(["assess", "track"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-brand text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t === "assess" ? "Risk Assessment" : "My Tracking"}
          </button>
        ))}
      </div>

      {tab === "track" ? (
        <Tracking inputs={formData} risk={riskScore} />
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-1">
          <h2 className="text-xl font-semibold mb-4">Patient Metrics</h2>
          <div className="space-y-5">
            {(Object.entries(formData) as [Feature, number][]).map(
              ([key, value]) => {
                const config = sliderConfigs[key];
                const Icon = metricIcons[key];
                return (
                  <div key={key} className="flex flex-col">
                    <div className="flex justify-between items-end gap-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <span className="bg-brand-soft text-brand rounded-lg p-1.5">
                          <Icon size={16} />
                        </span>
                        <span className="flex flex-col">
                          <span>{displayName(key)}</span>
                          {config.normal && (
                            <span className="text-[10px] text-gray-400 font-normal mt-0.5">
                              {config.normal}
                            </span>
                          )}
                        </span>
                      </label>
                      <span className="text-brand font-bold text-sm whitespace-nowrap">
                        {value}{" "}
                        <span className="text-xs font-medium">
                          {config.unit}
                        </span>
                      </span>
                    </div>
                    <input
                      type="range"
                      name={key}
                      min={config.min}
                      max={config.max}
                      step={config.step}
                      value={value}
                      onChange={handleSliderChange}
                      className="w-full mt-2 accent-brand"
                    />
                  </div>
                );
              },
            )}
          </div>
        </div>

        <div className="md:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-6">
            <Gauge value={riskScore} />
            <div className="flex-1 min-w-52">
              <h2 className="text-xl font-semibold text-gray-700">
                Predicted Risk
              </h2>
              <p className="text-sm text-gray-500">
                Based on our ML model
                {predicting && " · updating…"}
              </p>
              {riskScore !== null && !predicting && !predictError && (
                <p className="text-sm text-gray-500 mt-1">
                  Move any slider to score again.
                </p>
              )}
              {predictError && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm text-amber-600">{predictError}</p>
                  <button
                    onClick={() => void runPredict()}
                    className="px-3 py-1.5 bg-brand hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                  >
                    <RotateCcw size={14} /> Try again
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold mb-4">
              Why Did You Get This Score?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Red raises your risk. Green lowers it.
            </p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={shapData}
                  layout="vertical"
                  margin={{ left: 50 }}
                >
                  <XAxis type="number" />
                  <YAxis
                    dataKey="feature"
                    type="category"
                    width={100}
                    tick={{ fontSize: 12 }}
                    tickFormatter={displayName}
                  />
                  <Tooltip />
                  <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                    {shapData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.impact >= 0 ? "#ef4444" : "#22c55e"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gradient-to-br from-brand-soft to-brand-mist p-6 rounded-xl shadow-sm border border-brand-line">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-brand-deep flex items-center gap-2">
                <BrainCircuit size={24} className="text-brand" />
                AI Health Coach
              </h2>
              <button
                onClick={fetchAiCoach}
                disabled={loadingCoach || riskScore === null}
                className="px-4 py-2 bg-brand hover:bg-brand-deep text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loadingCoach ? "Analyzing..." : "Generate Action Plan"}
              </button>
            </div>

            {coachBasis && (
              <p className="text-xs text-gray-500 mb-3">{coachBasis}</p>
            )}

            {coachAdvice && (
              <div
                className="bg-white p-5 rounded-lg text-sm text-gray-800 border border-brand-line shadow-inner
                           [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-brand-deep [&>h3]:mb-3
                           [&>p]:mb-3 [&>ul]:list-disc [&>ul]:ml-5 [&>ul]:mb-4 [&>ul>li]:mb-1
                           [&>small]:text-xs [&>small]:text-gray-500 [&>small]:block [&>small]:mt-4 [&>small]:border-t [&>small]:pt-2"
                dangerouslySetInnerHTML={{ __html: coachAdvice }}
              />
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
