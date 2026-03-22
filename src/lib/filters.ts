const CLICKBAIT_RE =
  /\b(you won'?t believe|shocking|doctors hate|one weird trick|gone wrong|destroyed|meltdown|rage|lib(?:eral)?s?|conservative|woke)\b/i;

export function passesRuleFilter(title: string, summary: string): boolean {
  const text = `${title}\n${summary}`;
  if (CLICKBAIT_RE.test(text)) return false;
  return true;
}
