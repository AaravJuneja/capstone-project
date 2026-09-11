import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export function OutcomeBalance({
  healthy,
  diabetic,
}: {
  healthy: number;
  diabetic: number;
}) {
  const data = [
    { group: "Healthy (Outcome 0)", n: healthy },
    { group: "Diabetic (Outcome 1)", n: diabetic },
  ];
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
          <XAxis type="number" />
          <YAxis
            dataKey="group"
            type="category"
            width={150}
            tick={{ fontSize: 12 }}
          />
          <Tooltip />
          <Bar dataKey="n" radius={[0, 4, 4, 0]}>
            <Cell fill="#22c55e" />
            <Cell fill="#ef4444" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CorrChart({
  rows,
}: {
  rows: { feature: string; corr: number }[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 40 }}>
          <XAxis type="number" domain={[-0.1, 0.5]} />
          <YAxis
            dataKey="feature"
            type="category"
            width={150}
            tick={{ fontSize: 12 }}
          />
          <Tooltip />
          <Bar dataKey="corr" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AccuracyChart({
  rows,
}: {
  rows: { model: string; accuracy: number }[];
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 40 }}>
          <XAxis type="number" domain={[0, 1]} />
          <YAxis
            dataKey="model"
            type="category"
            width={150}
            tick={{ fontSize: 12 }}
          />
          <Tooltip />
          <Bar dataKey="accuracy" fill="#a869db" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
