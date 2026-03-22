import { z } from "zod";

const thresholdSchema = z.object({
  MIN_POSITIVITY: z.coerce.number().min(0).max(10).default(6),
  MAX_SENSATIONALISM: z.coerce.number().min(0).max(10).default(5),
  MAX_POLITICAL_CONTROVERSY: z.coerce.number().min(0).max(10).default(6),
  MIN_FIT_SCORE: z.coerce.number().min(0).max(10).default(6),
});

export function getClassificationThresholds() {
  const e = thresholdSchema.parse(process.env);
  return {
    minPositivity: e.MIN_POSITIVITY,
    maxSensationalism: e.MAX_SENSATIONALISM,
    maxPoliticalControversy: e.MAX_POLITICAL_CONTROVERSY,
    minFitScore: e.MIN_FIT_SCORE,
  };
}
