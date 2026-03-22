import Parser from "rss-parser";
import type { Item } from "rss-parser";

const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent": "GoodNewsBot/1.0 (+https://github.com/)",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

export type NormalizedItem = {
  title: string;
  summary: string;
  url: string;
  publishedAt: Date;
  imageUrl: string | null;
};

export type NormalizeItemOptions = {
  /** When RSS has no image, fetch article HTML and read og:image / twitter:image (slower). */
  fetchOgFallback?: boolean;
};

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function absolutize(base: string | undefined, candidate: string): string | null {
  const c = candidate.trim();
  if (!c || c.startsWith("data:")) return null;
  if (isHttpUrl(c)) return c;
  if (!base) return null;
  try {
    return new URL(c, base).href;
  } catch {
    return null;
  }
}

function firstImgFromHtml(html: string, baseUrl?: string): string | null {
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = absolutize(baseUrl, m[1]);
    if (url && !/\/spacer\.|\/pixel\.|1x1|tracking/i.test(url)) return url;
  }
  return null;
}

function pickImage(item: Item, pageUrl?: string): string | null {
  const raw = item as Item & {
    image?: string | { href?: string; url?: string; $?: { href?: string } };
    itunes?: { image?: string; href?: string };
    mediaContent?: Array<{ $?: { url?: string; medium?: string; type?: string } }>;
    mediaThumbnail?: { $?: { url?: string } };
  };

  if (typeof raw.image === "string" && isHttpUrl(raw.image)) return raw.image.trim();
  if (raw.image && typeof raw.image === "object") {
    const u = raw.image.href ?? raw.image.url ?? raw.image.$?.href;
    if (u && isHttpUrl(u)) return u;
  }

  const itunes = raw.itunes?.image ?? raw.itunes?.href;
  if (typeof itunes === "string" && isHttpUrl(itunes)) return itunes;

  const thumb = raw.mediaThumbnail?.$?.url;
  if (thumb) {
    const u = absolutize(pageUrl, thumb);
    if (u) return u;
  }

  const enc = item.enclosure as { url?: string; type?: string } | undefined;
  if (enc?.url && enc.type?.startsWith("image/")) {
    const u = absolutize(pageUrl, enc.url);
    if (u) return u;
  }

  if (enc?.url && /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(enc.url)) {
    const u = absolutize(pageUrl, enc.url);
    if (u) return u;
  }

  const mediaBlocks = raw.mediaContent;
  if (Array.isArray(mediaBlocks)) {
    for (const m of mediaBlocks) {
      const url = m?.$?.url;
      const medium = m?.$?.medium;
      const type = m?.$?.type;
      if (!url) continue;
      if (medium === "image" || type?.startsWith("image/") || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url)) {
        const u = absolutize(pageUrl, url);
        if (u) return u;
      }
    }
  }

  const encoded = item as Item & { "content:encoded"?: string };
  const html = encoded["content:encoded"] ?? item.content;
  if (typeof html === "string") {
    const fromHtml = firstImgFromHtml(html, pageUrl);
    if (fromHtml) return fromHtml;
  }

  const sum = item.summary;
  if (typeof sum === "string" && /<img/i.test(sum)) {
    const fromHtml = firstImgFromHtml(sum, pageUrl);
    if (fromHtml) return fromHtml;
  }

  return null;
}

/**
 * Fetch article page and extract og:image or twitter:image (best-effort).
 */
export async function fetchOgImage(pageUrl: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(pageUrl, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "GoodNewsBot/1.0 (+https://github.com/)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();

    const patterns: RegExp[] = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["']/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) {
        const u = absolutize(pageUrl, m[1]);
        if (u) return u;
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchFeed(feedUrl: string): Promise<Item[]> {
  const feed = await parser.parseURL(feedUrl);
  return feed.items ?? [];
}

export async function normalizeItem(item: Item, options: NormalizeItemOptions = {}): Promise<NormalizedItem | null> {
  const link = item.link?.trim();
  const title = (item.title ?? "").trim();
  if (!link || !title) return null;

  const summary =
    (item.contentSnippet ?? item.content ?? item.summary ?? "").replace(/\s+/g, " ").trim().slice(0, 2000) || title;

  const pub = item.pubDate ?? item.isoDate;
  const publishedAt = pub ? new Date(pub) : new Date();

  let imageUrl = pickImage(item, link);
  if (!imageUrl && options.fetchOgFallback) {
    imageUrl = await fetchOgImage(link);
  }

  return {
    title: title.slice(0, 500),
    summary,
    url: link,
    publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
    imageUrl,
  };
}
