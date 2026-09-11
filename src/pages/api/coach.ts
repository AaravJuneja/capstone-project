import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const MODEL = "gemini-2.0-flash";

export const POST: APIRoute = async (context) => {
  const key = env.GEMINI_API_KEY ?? import.meta.env.GEMINI_API_KEY;
  if (!key) {
    return Response.json(
      { error: "Coach not configured. Set the GEMINI_API_KEY secret." },
      { status: 503 },
    );
  }

  let body: {
    patient?: Record<string, number>;
    risk_score?: number;
    trend?: string;
  };
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { patient, risk_score, trend } = body;
  if (!patient || typeof risk_score !== "number") {
    return Response.json(
      { error: "Body needs { patient, risk_score }." },
      { status: 400 },
    );
  }

  const prompt = `You are an empathetic and professional AI Health Coach.
A user has submitted their health metrics:
- Age: ${patient.Age}
- BMI: ${patient.BMI}
- Glucose: ${patient.Glucose}
- Blood Pressure: ${patient.BloodPressure}
${trend ? `Recent trajectory: ${trend}.\n` : ""}
Based on our predictive model, they have a ${risk_score}% predicted chance of developing diabetes.

Please provide 3 friendly actionable, and non-medical lifestyle tips to help them improve their health.

IMPORTANT: Return your entire response strictly as raw HTML.
Use semantic tags like <h3>, <p>, <ul>, <li>, and <strong>.
Do NOT wrap the response in markdown blocks (e.g., do not use \`\`\`html).
Keep the tone encouraging, and add a brief medical disclaimer in a <small> tag at the end.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  if (!res.ok) {
    return Response.json(
      { error: `Coach provider failed: ${res.status}` },
      { status: 502 },
    );
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";
  if (!text.trim()) {
    return Response.json({ error: "Empty coach response." }, { status: 502 });
  }
  return Response.json({ coach_advice: text.trim() });
};
