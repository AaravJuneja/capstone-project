import { useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Activity, BrainCircuit } from "lucide-react";
import Tracking from "./Tracking";

const API_URL =
  import.meta.env.PUBLIC_API_URL ??
  "https://ai-capstone-backend-d09i.onrender.com";

type FormData = {
  Pregnancies: number;
  Glucose: number;
  BloodPressure: number;
  SkinThickness: number;
  Insulin: number;
  BMI: number;
  DiabetesPedigreeFunction: number;
  Age: number;
};

const sliderConfigs: Record<
  keyof FormData,
  { min: number; max: number; step: number; unit: string; normal: string }
> = {
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

export default function Dashboard() {
  const [formData, setFormData] = useState<FormData>({
    Pregnancies: 0,
    Glucose: 100,
    BloodPressure: 70,
    SkinThickness: 20,
    Insulin: 80,
    BMI: 25,
    DiabetesPedigreeFunction: 0.5,
    Age: 30,
  });

  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [shapData, setShapData] = useState<{ feature: string; impact: number }[]>(
    [],
  );
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [coachAdvice, setCoachAdvice] = useState<string>("");
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [tab, setTab] = useState<"assess" | "track">("assess");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setPredicting(true);
      setPredictError(null);
      try {
        const res = await fetch(`${API_URL}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`predict failed: ${res.status}`);
        const data = await res.json();
        if (data.risk_score !== undefined) {
          setRiskScore(data.risk_score);
          const formatted = Object.entries(
            (data.shap_values ?? {}) as Record<string, unknown>,
          ).map(([key, val]) => ({
            feature: key,
            impact: Number(val),
          }));
          setShapData(formatted);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch prediction", err);
        setPredictError("Could not reach the prediction service. Retrying…");
      } finally {
        if (abortRef.current === controller) setPredicting(false);
      }
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
    try {
      const res = await fetch(`${API_URL}/coach?risk_score=${riskScore}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-blue-600 flex items-center gap-2">
          <Activity size={32} /> Diabetes Risk Assessment
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          For educational purposes only. This tool is not a substitute for
          professional medical advice.
        </p>
      </header>

      <div className="flex gap-2 mb-8">
        {(["assess", "track"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-blue-600 text-white"
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
            {(Object.entries(formData) as [keyof FormData, number][]).map(
              ([key, value]) => {
                const config = sliderConfigs[key];
                return (
                  <div key={key} className="flex flex-col">
                    <div className="flex justify-between items-end">
                      <label className="text-sm font-medium text-gray-700 flex flex-col">
                        <span>{key}</span>
                        {config.normal && (
                          <span className="text-[10px] text-gray-400 font-normal mt-0.5">
                            {config.normal}
                          </span>
                        )}
                      </label>
                      <span className="text-blue-600 font-bold text-sm">
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
                      className="w-full mt-2 accent-blue-600"
                    />
                  </div>
                );
              },
            )}
          </div>
        </div>

        <div className="md:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-700">
                Predicted Risk
              </h2>
              <p className="text-sm text-gray-500">
                Based on our Machine Learning Model
                {predicting && " · updating…"}
              </p>
              {predictError && (
                <p className="text-sm text-red-500 mt-1">{predictError}</p>
              )}
            </div>
            <div className="text-5xl font-bold text-blue-600">
              {riskScore !== null ? `${riskScore.toFixed(1)}%` : "--%"}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold mb-4">
              Why Did You Get This Score?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Positive values increase your risk; negative values decrease it.
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
                  />
                  <Tooltip />
                  <Bar dataKey="impact" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl shadow-sm border border-blue-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-blue-900 flex items-center gap-2">
                <BrainCircuit size={24} className="text-blue-600" />
                AI Health Coach
              </h2>
              <button
                onClick={fetchAiCoach}
                disabled={loadingCoach || riskScore === null}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loadingCoach ? "Analyzing..." : "Generate Action Plan"}
              </button>
            </div>

            {coachAdvice && (
              <div
                className="bg-white p-5 rounded-lg text-sm text-gray-800 border border-blue-100 shadow-inner
                           [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-blue-800 [&>h3]:mb-3
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
