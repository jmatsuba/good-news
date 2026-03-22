import { NextRequest, NextResponse } from "next/server";
import { getArticleById } from "@/lib/articles";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const article = await getArticleById(id);

  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: article.id,
    title: article.title,
    summary: article.summary,
    url: article.url,
    sourceName: article.sourceName,
    publishedAt: article.publishedAt.toISOString(),
    imageUrl: article.imageUrl,
    fitScore: article.fitScore,
    tags: article.tags.map((at) => ({ slug: at.tag.slug, label: at.tag.label })),
  });
}
