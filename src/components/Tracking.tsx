import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { UserPlus, Save, Upload, Download, Trash2 } from "lucide-react";
import type { Checkin, Inputs, Person } from "../lib/metrics";
import {
  assess,
  bandHits,
  distGap,
  riskSlope,
  statusClass,
  statusLabel,
} from "../lib/risk";
import {
  download,
  loadStore,
  parseReportCsv,
  saveSelected,
  saveStore,
  today,
  uid,
  csvTemplate,
} from "../lib/store";

interface Props {
  inputs: Inputs;
  risk: number | null;
}

export default function Tracking({ inputs, risk }: Props) {
  const [persons, setPersons] = useState<Person[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [date, setDate] = useState(today());
  const [notice, setNotice] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  useEffect(() => {
    const s = loadStore();
    setPersons(s.persons);
    setCheckins(s.checkins);
    if (s.persons.length > 0) setSelectedId(s.persons[0].id);
  }, []);

  useEffect(() => {
    saveSelected(selectedId);
  }, [selectedId]);

  const persist = (p: Person[], c: Checkin[]) => {
    setPersons(p);
    setCheckins(c);
    saveStore({ persons: p, checkins: c });
  };

  const mine = useMemo(
    () =>
      checkins
        .filter((c) => c.personId === selectedId)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [checkins, selectedId],
  );

  const selected = persons.find((p) => p.id === selectedId);
  const latest = mine[mine.length - 1];
  const slope = useMemo(() => riskSlope(mine.map((c) => c.risk)), [mine]);

  const current = useMemo(() => {
    const { count } = bandHits(inputs);
    const gap = distGap(inputs);
    return { hits: count, gap, status: assess(risk, count, gap) };
  }, [inputs, risk]);

  const addPerson = () => {
    const name = newName.trim();
    if (!name) return;
    const p: Person = { id: uid(), name, createdAt: new Date().toISOString() };
    const next = [...persons, p];
    persist(next, checkins);
    setSelectedId(p.id);
    setNewName("");
  };

  const removePerson = () => {
    if (!selectedId) return;
    persist(
      persons.filter((p) => p.id !== selectedId),
      checkins.filter((c) => c.personId !== selectedId),
    );
    setSelectedId("");
  };

  const saveCheckin = () => {
    if (!selectedId) {
      setNotice("Create a profile first.");
      return;
    }
    const { count } = bandHits(inputs);
    const gap = distGap(inputs);
    const c: Checkin = {
      id: uid(),
      personId: selectedId,
      date,
      inputs: { ...inputs },
      risk,
      bandHits: count,
      distGap: gap,
    };
    persist(persons, [...checkins, c]);
    setNotice(`Saved checkin for ${date}.`);
  };

  const removeCheckin = (id: string) => {
    persist(persons, checkins.filter((c) => c.id !== id));
  };

  const onFile = async (file: File) => {
    if (!selectedId) {
      setNotice("Create a profile first.");
      return;
    }
    const text = await file.text();
    const { rows, errors } = parseReportCsv(text);
    setImportErrors(errors);
    if (rows.length === 0) {
      setNotice("No valid rows found in that file.");
      return;
    }
    const fresh: Checkin[] = rows.map((r) => {
      const { count } = bandHits(r.inputs);
      const gap = distGap(r.inputs);
      return {
        id: uid(),
        personId: selectedId,
        date: r.date,
        inputs: r.inputs,
        risk: null,
        bandHits: count,
        distGap: gap,
      };
    });
    persist(persons, [...checkins, ...fresh]);
    setNotice(
      `Imported ${fresh.length} rows without live risk. Move the sliders to a matching reading and save for a scored checkin.`,
    );
  };

  const chartData = mine.map((c) => ({
    date: c.date.slice(5),
    fullDate: c.date,
    risk: c.risk,
    status: assess(c.risk, c.bandHits, c.distGap),
  }));

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold mb-1">Personal Profiling</h2>
        <p className="text-sm text-gray-500 mb-4">
          Routine checkins per person. History stays in this browser. No
          account and no fees. Export anytime for your records.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">Select profile…</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New person name"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <button
            onClick={addPerson}
            className="px-3 py-2 bg-brand hover:bg-brand-deep text-white rounded-lg text-sm font-medium flex items-center gap-1"
          >
            <UserPlus size={16} /> Add
          </button>
          {selected && (
            <button
              onClick={removePerson}
              className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium flex items-center gap-1"
            >
              <Trash2 size={16} /> Delete profile
            </button>
          )}
        </div>
        {notice && <p className="text-sm text-brand-deep mt-3">{notice}</p>}
      </div>

      {selected && (
        <>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-1">
              Save current sliders as a checkin
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Current reading:{" "}
              <span className="font-bold text-brand">
                {risk !== null ? `${risk.toFixed(1)}%` : "--%"}
              </span>{" "}
              ·{" "}
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass[current.status]}`}
              >
                {statusLabel[current.status]}
              </span>{" "}
              · {current.hits}/8 metrics in the diabetic zone · gap{" "}
              {current.gap}
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <button
                onClick={saveCheckin}
                className="px-4 py-2 bg-brand hover:bg-brand-deep text-white rounded-lg text-sm font-medium flex items-center gap-1"
              >
                <Save size={16} /> Save checkin for {selected.name}
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-lg font-semibold">
                Trajectory for {selected.name}
                {mine.length > 0 && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    {mine.length} checkins
                    {slope !== null &&
                      ` · trend ${slope > 0 ? "+" : ""}${slope}% per checkin`}
                  </span>
                )}
              </h3>
              <div className="flex gap-2">
                <label className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-1">
                  <Upload size={16} /> Upload report CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  onClick={() => download("template.csv", csvTemplate())}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium"
                >
                  Template
                </button>
                <button
                  onClick={() =>
                    mine.length > 0 &&
                    download(`${selected.name}-checkins.csv`, exportCsv(mine))
                  }
                  disabled={mine.length === 0}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  <Download size={16} /> Export
                </button>
              </div>
            </div>

            {importErrors.length > 0 && (
              <ul className="text-sm text-red-600 mb-4 list-disc ml-5">
                {importErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}

            {mine.length === 0 ? (
              <p className="text-sm text-gray-500">
                No checkins yet. Save the sliders above or upload a report
                CSV with columns: date, Pregnancies, Glucose, BloodPressure,
                SkinThickness, Insulin, BMI, DiabetesPedigreeFunction, Age.
              </p>
            ) : (
              <>
                <div className="h-64 w-full mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ left: -10 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                        label={{
                          value: "risk %",
                          angle: -90,
                          fontSize: 12,
                        }}
                      />
                      <Tooltip
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.fullDate ?? ""
                        }
                      />
                      <ReferenceLine
                        y={60}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        label={{ value: "bad zone", fontSize: 11 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="risk"
                        stroke="#2563eb"
                        strokeWidth={2}
                        connectNulls
                        dot={(props: {
                          cx?: number;
                          cy?: number;
                          payload?: { status?: string };
                        }) => {
                          const color =
                            props.payload?.status === "warning"
                              ? "#ef4444"
                              : props.payload?.status === "watch"
                                ? "#eab308"
                                : "#22c55e";
                          return (
                            <circle
                              cx={props.cx}
                              cy={props.cy}
                              r={4}
                              fill={color}
                            />
                          );
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {latest && (
                  <div className="mb-4 text-sm">
                    Latest ({latest.date}):{" "}
                    <span className="font-bold">
                      {latest.risk !== null
                        ? `${latest.risk.toFixed(1)}%`
                        : "no live risk"}
                    </span>{" "}
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass[assess(latest.risk, latest.bandHits, latest.distGap)]}`}
                    >
                      {
                        statusLabel[
                          assess(latest.risk, latest.bandHits, latest.distGap)
                        ]
                      }
                    </span>{" "}
                    <span className="text-gray-500">
                      · {latest.bandHits}/8 in diabetic zone · gap{" "}
                      {latest.distGap}
                    </span>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Risk</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Bad zone metrics</th>
                        <th className="py-2 pr-4">Gap</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...mine].reverse().map((c) => {
                        const s = assess(c.risk, c.bandHits, c.distGap);
                        return (
                          <tr key={c.id} className="border-b last:border-0">
                            <td className="py-2 pr-4">{c.date}</td>
                            <td className="py-2 pr-4 font-medium">
                              {c.risk !== null ? `${c.risk.toFixed(1)}%` : "--"}
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass[s]}`}
                              >
                                {statusLabel[s]}
                              </span>
                            </td>
                            <td className="py-2 pr-4">{c.bandHits}/8</td>
                            <td className="py-2 pr-4">{c.distGap}</td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => removeCheckin(c.id)}
                                className="text-red-500 hover:text-red-700"
                                aria-label="Delete checkin"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {persons.length === 0 && (
        <p className="text-sm text-gray-500">
          Start by adding a profile above, for example yourself or a family
          member you track routinely.
        </p>
      )}
    </div>
  );
}
