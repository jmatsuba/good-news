/**
 * Fills missing imageUrl for existing articles by fetching og:image from the article URL.
 * Run: npm run db:backfill-images
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";
import { fetchOgImage } from "../src/lib/rss";

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
    /* no .env */
  }
}

const prisma = new PrismaClient();
const DELAY_MS = 200;

async function main() {
  loadEnv();

  const rows = await prisma.article.findMany({
    where: { imageUrl: null },
    select: { id: true, url: true },
    take: 200,
    orderBy: { publishedAt: "desc" },
  });

  let updated = 0;
  for (const row of rows) {
    const img = await fetchOgImage(row.url);
    if (img) {
      await prisma.article.update({
        where: { id: row.id },
        data: { imageUrl: img },
      });
      updated++;
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`Backfill complete: updated ${updated} of ${rows.length} articles missing images.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
