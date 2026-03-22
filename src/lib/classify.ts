import OpenAI from "openai";
import { z } from "zod";
import { getClassificationThresholds } from "@/lib/env";

const classificationSchema = z.object({
  positivity: z.number().min(0).max(10),
  sensationalism: z.number().min(0).max(10),
  politicalControversy: z.number().min(0).max(10),
  fitScore: z.number().min(0).max(10),
  isPositiveUplifting: z.boolean(),
  recommendedSlugs: z.array(z.string()),
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

export async function classifyArticle(input: {
  title: string;
  summary: string;
  sourceName: string;
}): Promise<{ classification: Classification; published: boolean }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const openai = new OpenAI({ apiKey });

  const system = `You are a strict editor for a "good news" site. Score each article for:
- positivity (0-10): uplifting, constructive, solutions-oriented, hope.
- sensationalism (0-10): higher if headline/snippet is clickbait, outrage, fear-mongering, or hype.
- politicalControversy (0-10): higher if primarily partisan conflict, culture-war framing, or likely to polarize.
- fitScore (0-10): overall fit for a calm, neutral, non-sensational good-news site.

isPositiveUplifting: true only if the story is clearly net-positive and appropriate for a general audience.

recommendedSlugs: choose zero or more from: tech, animals, health, politics, environment, science, culture, world — only if clearly relevant.

rejectReason: short text if the story should be rejected (partisan attack, tragedy-focused, unclear, etc.), else null.`;

  const user = JSON.stringify({
    title: input.title,
    summary: input.summary.slice(0, 4000),
    sourceName: input.sourceName,
  });

  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Return JSON with keys: positivity, sensationalism, politicalControversy, fitScore (numbers 0-10), isPositiveUplifting (boolean), recommendedSlugs (string array), rejectReason (string or null).\nArticle:\n${user}`,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty classification response");

  const parsedJson = JSON.parse(raw) as unknown;
  const classification = classificationSchema.parse(parsedJson);
  const published = passesThresholds(classification);
  return { classification, published };
}
