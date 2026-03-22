import Parser from "rss-parser";
import type { Item } from "rss-parser";

const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent": "GoodNewsBot/1.0 (+https://github.com/)",
  },
});

export type NormalizedItem = {
  title: string;
  summary: string;
  url: string;
  publishedAt: Date;
  imageUrl: string | null;
};

function pickImage(item: Item): string | null {
  const media =
    (item as { media?: { $?: { url?: string } }; enclosure?: { url?: string } }).enclosure?.url ??
    (item as { media?: { $?: { url?: string } } }).media?.$?.url;
  if (media && /^https?:\/\//i.test(media)) return media;
  const raw = item as Item & { "content:encoded"?: string };
  const content = raw["content:encoded"] ?? item.content;
  if (typeof content === "string") {
    const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m?.[1]) return m[1];
  }
  return null;
}

export async function fetchFeed(feedUrl: string): Promise<Item[]> {
  const feed = await parser.parseURL(feedUrl);
  return feed.items ?? [];
}

export function normalizeItem(item: Item): NormalizedItem | null {
  const link = item.link?.trim();
  const title = (item.title ?? "").trim();
  if (!link || !title) return null;

  const summary =
    (item.contentSnippet ?? item.content ?? item.summary ?? "").replace(/\s+/g, " ").trim().slice(0, 2000) ||
    title;

  const pub = item.pubDate ?? item.isoDate;
  const publishedAt = pub ? new Date(pub) : new Date();

  return {
    title: title.slice(0, 500),
    summary,
    url: link,
    publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
    imageUrl: pickImage(item),
  };
}
