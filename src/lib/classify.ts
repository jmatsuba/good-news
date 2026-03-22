import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { getClassificationThresholds } from "@/lib/env";

const score = z.coerce.number().min(0).max(10);

const classificationSchema = z.object({
  positivity: score,
  sensationalism: score,
  politicalControversy: score,
  fitScore: score,
  isPositiveUplifting: z.coerce.boolean(),
  recommendedSlugs: z.preprocess(
    (v) => (v == null ? [] : Array.isArray(v) ? v : [String(v)]),
    z.array(z.string()),
  ),
  rejectReason: z.string().nullable().optional(),
});

export type Classification = z.infer<typeof classificationSchema>;

export function passesThresholds(c: Classification): boolean {
  const t = getClassificationThresholds();
  if (!c.isPositiveUplifting) return false;
  if (c.positivity < t.minPositivity) return false;
  if (c.sensationalism > t.maxSensationalism) return false;
  if (c.politicalControversy > t.maxPoliticalControversy) return false;
  if (c.fitScore < t.minFitScore) return false;
  return true;
}

const SYSTEM = `You are a strict editor for a "good news" site. Score each article for:
- positivity (0-10): uplifting, constructive, solutions-oriented, hope.
- sensationalism (0-10): higher if headline/snippet is clickbait, outrage, fear-mongering, or hype.
- politicalControversy (0-10): higher if primarily partisan conflict, culture-war framing, or likely to polarize.
- fitScore (0-10): overall fit for a calm, neutral, non-sensational good-news site.

isPositiveUplifting: true only if the story is clearly net-positive and appropriate for a general audience.

recommendedSlugs: choose zero or more from: tech, animals, health, politics, environment, science, culture, world — only if clearly relevant.

rejectReason: short text if the story should be rejected (partisan attack, tragedy-focused, unclear, etc.), else null.

Respond with JSON only (no markdown fences), single object with keys: positivity, sensationalism, politicalControversy, fitScore, isPositiveUplifting, recommendedSlugs, rejectReason.`;

function parseJsonFromModelText(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  const body = fence ? fence[1].trim() : trimmed;
  return JSON.parse(body) as unknown;
}

export async function classifyArticle(input: {
  title: string;
  summary: string;
  sourceName: string;
}): Promise<{ classification: Classification; published: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const userPayload = JSON.stringify({
    title: input.title,
    summary: input.summary.slice(0, 4000),
    sourceName: input.sourceName,
  });

  const result = await model.generateContent(
    `Classify this article and output only the JSON object described in your instructions.\n\nArticle:\n${userPayload}`,
  );

  const raw = result.response.text();
  if (!raw) throw new Error("Empty classification response");

  const parsedJson = parseJsonFromModelText(raw);
  const classification = classificationSchema.parse(parsedJson);
  const published = passesThresholds(classification);
  return { classification, published };
}
