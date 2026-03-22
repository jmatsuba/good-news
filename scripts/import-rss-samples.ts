/**
 * One-off / demo import: pulls real items from configured RSS feeds and stores them as PUBLISHED
 * so the UI can be exercised without running the full LLM ingest pipeline.
 * Run: npm run db:import-samples
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ArticleStatus, PrismaClient } from "@prisma/client";
import feedsConfig from "../src/config/feeds.json";
import { fetchFeed, normalizeItem } from "../src/lib/rss";
import { passesRuleFilter } from "../src/lib/filters";

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

const PER_FEED = 10;
const HIGHLIGHT_FIRST = 5;

function guessSlugs(title: string, summary: string): string[] {
  const text = `${title} ${summary}`.toLowerCase();
  const out = new Set<string>();
  const rules: [string, string][] = [
    ["tech", "tech|software|ai |algorithm|computer|chip|startup|app "],
    ["health", "health|medical|clinic|hospital|vaccine|therapy|cancer|disease|patient"],
    ["science", "science|research|study |scientists|physics|chemistry|biology|space "],
    ["environment", "climate|solar|wind |forest|ocean|carbon|green |wildlife|conservation"],
    ["animals", "animal|dog |cat |bird|wildlife|species|zoo|marine"],
    ["politics", "election|government|parliament|senate|minister|policy|vote|law "],
    ["world", "global|international|nation|country|refugee|un "],
    ["culture", "music|film|art |museum|book |theatre|festival"],
  ];
  for (const [slug, pattern] of rules) {
    const re = new RegExp(pattern, "i");
    if (re.test(text)) out.add(slug);
  }
  if (out.size === 0) out.add("world");
  return [...out];
}

async function main() {
  loadEnv();

  const feeds = feedsConfig.feeds as { url: string; sourceName: string }[];
  let imported = 0;
  const createdIds: string[] = [];

  for (const feed of feeds) {
    let items;
    try {
      items = await fetchFeed(feed.url);
    } catch (e) {
      console.warn(`Skip feed ${feed.url}:`, e instanceof Error ? e.message : e);
      continue;
    }

    let n = 0;
    for (const item of items) {
      if (n >= PER_FEED) break;
      const norm = await normalizeItem(item, { fetchOgFallback: true });
      if (!norm) continue;
      if (!passesRuleFilter(norm.title, norm.summary)) continue;

      const existing = await prisma.article.findUnique({ where: { url: norm.url } });
      if (existing) continue;

      const article = await prisma.article.create({
        data: {
          title: norm.title,
          summary: norm.summary,
          url: norm.url,
          sourceName: feed.sourceName,
          publishedAt: norm.publishedAt,
          imageUrl: norm.imageUrl,
          status: ArticleStatus.PUBLISHED,
          highlighted: false,
          positivity: 7.5,
          sensationalism: 3,
          politicalControversy: 2,
          fitScore: 7.5,
          classificationJson: {
            source: "import-rss-samples",
            note: "Demo import without LLM; replace with full ingest in production.",
          },
        },
      });

      const slugs = guessSlugs(norm.title, norm.summary);
      for (const slug of slugs) {
        const tag = await prisma.tag.upsert({
          where: { slug },
          create: { slug, label: slug.charAt(0).toUpperCase() + slug.slice(1) },
          update: {},
        });
        await prisma.articleTag.create({
          data: { articleId: article.id, tagId: tag.id },
        });
      }

      createdIds.push(article.id);
      imported++;
      n++;
    }
  }

  const toHighlight = createdIds.slice(0, HIGHLIGHT_FIRST);
  if (toHighlight.length) {
    await prisma.article.updateMany({
      where: { id: { in: toHighlight } },
      data: { highlighted: true },
    });
  }

  console.log(`Imported ${imported} published articles from RSS (highlighted ${toHighlight.length} for Spotlight).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
