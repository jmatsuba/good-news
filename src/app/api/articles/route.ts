import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listArticles, type ArticleSort } from "@/lib/articles";

const querySchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  sort: z.enum(["newest", "relevant", "rated"]).default("newest"),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

function serializeArticle(
  a: Awaited<ReturnType<typeof listArticles>>["articles"][number],
) {
  return {
    id: a.id,
    title: a.title,
    summary: a.summary,
    url: a.url,
    sourceName: a.sourceName,
    publishedAt: a.publishedAt.toISOString(),
    imageUrl: a.imageUrl,
    fitScore: a.fitScore,
    tags: a.tags.map((at) => ({ slug: at.tag.slug, label: at.tag.label })),
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    q: sp.get("q") ?? undefined,
    tag: sp.get("tag") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    limit: sp.get("limit") ?? undefined,
    offset: sp.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { articles, hasMore } = await listArticles({
    q: parsed.data.q,
    tag: parsed.data.tag,
    sort: parsed.data.sort as ArticleSort,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  });

  return NextResponse.json({
    articles: articles.map(serializeArticle),
    hasMore,
    nextOffset: hasMore ? parsed.data.offset + parsed.data.limit : null,
  });
}
