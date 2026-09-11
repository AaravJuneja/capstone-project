import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Strongest free options first, auto router last so a delisted
// endpoint can never take the coach down with it.
const MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "google/gemma-4-31b-it:free",
  "openai/gpt-oss-20b:free",
  "openrouter/free",
];

const RETRYABLE = new Set([400, 404, 408, 429, 502, 503, 529]);

export const POST: APIRoute = async (context) => {
  const key = env.OPENROUTER_API_KEY ?? import.meta.env.OPENROUTER_API_KEY;
  if (!key) {
    return Response.json(
      { error: "Coach not configured. Set the OPENROUTER_API_KEY secret." },
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

  const trendLine = trend
    ? `Recent checkins show this: ${trend}. `
    : "";
  const system =
    "You are a warm and professional health coach. " +
    "Write in a plain human voice that a friend would use. " +
    "Never use em dashes or en dashes or hyphens or Oxford commas. " +
    "Avoid flowery phrasing and avoid robotic lists. " +
    "Reply with raw HTML only, using h3 and p and ul and li and strong tags. " +
    "Do not use code fences. " +
    "End with a short medical disclaimer inside a small tag.";
  const user =
    `The user shared these health numbers. ` +
    `Age ${patient.Age}. ` +
    `BMI ${patient.BMI}. ` +
    `Glucose ${patient.Glucose}. ` +
    `Blood pressure ${patient.BloodPressure}. ` +
    trendLine +
    `Our model predicts about a ${risk_score} percent chance of developing diabetes. ` +
    `Give 3 friendly and practical lifestyle tips that support general wellness. ` +
    `These tips are for education only and are not medical advice.`;

  let lastStatus = 502;
  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "https://capstone.aarav-juneja2044.workers.dev",
          "X-Title": "capstone",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.7,
          reasoning: { effort: "high", exclude: true },
        }),
      });
    } catch {
      lastStatus = 502;
      continue;
    }
    if (RETRYABLE.has(res.status)) {
      lastStatus = res.status;
      continue;
    }
    if (!res.ok) {
      return Response.json(
        { error: `Coach provider failed: ${res.status}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    const clean = text
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
    if (!clean) {
      lastStatus = 502;
      continue;
    }
    return Response.json({ coach_advice: clean, model });
  }

  return Response.json(
    { error: `Coach provider failed: ${lastStatus}` },
    { status: 502 },
  );
};
