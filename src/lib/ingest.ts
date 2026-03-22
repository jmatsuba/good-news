import { Prisma, ArticleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import feedsConfig from "@/config/feeds.json";
import { fetchFeed, normalizeItem } from "@/lib/rss";
import { passesRuleFilter } from "@/lib/filters";
import { classifyArticle } from "@/lib/classify";

const ALLOWED_SLUGS = new Set([
  "tech",
  "animals",
  "health",
  "politics",
  "environment",
  "science",
  "culture",
  "world",
]);

function getFeedList(): { url: string; sourceName: string }[] {
  const fromFile = feedsConfig.feeds as { url: string; sourceName: string }[];
  const extra = process.env.RSS_FEED_URLS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const merged = [...fromFile];
  for (const u of extra) {
    merged.push({ url: u, sourceName: new URL(u).hostname });
  }
  return merged;
}

export async function runIngestion(): Promise<{
  fetchedCount: number;
  newCount: number;
  publishedCount: number;
  rejectedCount: number;
}> {
  const run = await prisma.ingestionRun.create({
    data: { status: "running" },
  });

  let fetchedCount = 0;
  let newCount = 0;
  let publishedCount = 0;
  let rejectedCount = 0;

  try {
    const feeds = getFeedList();

    for (const feed of feeds) {
      let items;
      try {
        items = await fetchFeed(feed.url);
      } catch {
        continue;
      }

      for (const item of items) {
        fetchedCount++;
        const norm = await normalizeItem(item, {
          fetchOgFallback: process.env.ENRICH_OG_IMAGES === "true",
        });
        if (!norm) continue;

        if (!passesRuleFilter(norm.title, norm.summary)) {
          continue;
        }

        const existing = await prisma.article.findUnique({ where: { url: norm.url } });
        if (existing) continue;

        newCount++;

        if (!process.env.OPENAI_API_KEY) {
          await prisma.article.create({
            data: {
              title: norm.title,
              summary: norm.summary,
              url: norm.url,
              sourceName: feed.sourceName,
              publishedAt: norm.publishedAt,
              imageUrl: norm.imageUrl,
              status: ArticleStatus.CANDIDATE,
              classificationJson: { error: "OPENAI_API_KEY missing" } as Prisma.InputJsonValue,
            },
          });
          continue;
        }

        let classification: Awaited<ReturnType<typeof classifyArticle>> | null = null;
        try {
          classification = await classifyArticle({
            title: norm.title,
            summary: norm.summary,
            sourceName: feed.sourceName,
          });
        } catch {
          await prisma.article.create({
            data: {
              title: norm.title,
              summary: norm.summary,
              url: norm.url,
              sourceName: feed.sourceName,
              publishedAt: norm.publishedAt,
              imageUrl: norm.imageUrl,
              status: ArticleStatus.REJECTED,
              classificationJson: { error: "classification_failed" } as Prisma.InputJsonValue,
            },
          });
          rejectedCount++;
          continue;
        }

        const { classification: c, published } = classification;

        const status = published ? ArticleStatus.PUBLISHED : ArticleStatus.REJECTED;
        if (published) publishedCount++;
        else rejectedCount++;

        const article = await prisma.article.create({
          data: {
            title: norm.title,
            summary: norm.summary,
            url: norm.url,
            sourceName: feed.sourceName,
            publishedAt: norm.publishedAt,
            imageUrl: norm.imageUrl,
            status,
            positivity: c.positivity,
            sensationalism: c.sensationalism,
            politicalControversy: c.politicalControversy,
            fitScore: c.fitScore,
            classificationJson: c as unknown as Prisma.InputJsonValue,
          },
        });

        if (published && c.recommendedSlugs?.length) {
          const slugs = [...new Set(c.recommendedSlugs.map((s) => s.toLowerCase()))].filter((s) =>
            ALLOWED_SLUGS.has(s),
          );
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
        }
      }
    }

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        fetchedCount,
        newCount,
        publishedCount,
        rejectedCount,
      },
    });

    return { fetchedCount, newCount, publishedCount, rejectedCount };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        fetchedCount,
        newCount,
        publishedCount,
        rejectedCount,
        errorMessage: message,
      },
    });
    throw e;
  }
}
