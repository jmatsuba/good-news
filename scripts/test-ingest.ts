/**
 * Run the full ingestion pipeline locally (same as POST /api/ingest).
 * Prints counts on success, full stack trace on failure.
 *
 *   npm run test:ingest
 *
 * Requires: .env with DATABASE_URL, GEMINI_API_KEY (for classification), and reachable Postgres.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    console.error("No .env file found — copy .env.example to .env and set DATABASE_URL, GEMINI_API_KEY.");
    process.exit(1);
  }
}

const prisma = new PrismaClient();

async function main() {
  loadEnv();

  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
  if (missing.length) {
    console.error(`Missing env: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log("Starting ingestion (local)…\n");

  const { runIngestion } = await import("../src/lib/ingest");
  const result = await runIngestion();

  console.log("OK:", JSON.stringify(result, null, 2));

  if (result.newCount > 0 && result.publishedCount === 0) {
    console.log("\n--- Note: new items were ingested but none were published. ---");
    console.log("Common causes: thresholds too strict (MIN_POSITIVITY, MAX_SENSATIONALISM, …),");
    console.log("or the model marked stories as not uplifting. Sample rejected row:\n");

    const sample = await prisma.article.findFirst({
      where: { status: "REJECTED" },
      orderBy: { createdAt: "desc" },
      select: { title: true, classificationJson: true },
    });
    if (sample) {
      console.log("Title:", sample.title);
      console.log("classificationJson:", JSON.stringify(sample.classificationJson, null, 2));
    }
  }
}

main()
  .catch((e) => {
    console.error("\nIngest failed:\n");
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
