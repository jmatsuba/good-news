import { Prisma, ArticleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ArticleSort = "newest" | "relevant" | "rated";

export type ListArticlesParams = {
  q?: string;
  tag?: string;
  sort: ArticleSort;
  limit: number;
  offset: number;
  /** Dedupe against hero rail on the home page */
  excludeIds?: string[];
};

const articleInclude = {
  tags: { include: { tag: true } },
} as const;

export async function listArticles(params: ListArticlesParams) {
  const { q, tag, sort, limit, offset, excludeIds } = params;

  const tagFilter = tag
    ? {
        tags: {
          some: {
            tag: { slug: tag.toLowerCase() },
          },
        },
      }
    : {};

  const baseWhere: Prisma.ArticleWhereInput = {
    status: ArticleStatus.PUBLISHED,
    ...(excludeIds?.length ? { id: { notIn: excludeIds } } : {}),
    ...tagFilter,
  };

  if (q?.trim()) {
    const term = q.trim();
    const tagClause = tag
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "ArticleTag" at
          INNER JOIN "Tag" t ON t.id = at."tagId"
          WHERE at."articleId" = a.id AND t.slug = ${tag.toLowerCase()}
        )`
      : Prisma.empty;

    const excludeClause =
      excludeIds?.length && excludeIds.length > 0
        ? Prisma.sql`AND a.id NOT IN (${Prisma.join(excludeIds)})`
        : Prisma.empty;

    const ids = await prisma.$queryRaw<{ id: string }[]>`
      SELECT a.id
      FROM "Article" a
      WHERE a.status = 'PUBLISHED'
      ${excludeClause}
      ${tagClause}
        AND to_tsvector('english', a.title || ' ' || coalesce(a.summary, ''))
            @@ plainto_tsquery('english', ${term})
      ORDER BY ts_rank(
        to_tsvector('english', a.title || ' ' || coalesce(a.summary, '')),
        plainto_tsquery('english', ${term})
      ) DESC,
      a."publishedAt" DESC
      LIMIT ${limit + 1}
      OFFSET ${offset}
    `;

    const hasMore = ids.length > limit;
    const idList = ids.slice(0, limit).map((r) => r.id);
    if (idList.length === 0) {
      return { articles: [], hasMore: false };
    }

    const articles = await prisma.article.findMany({
      where: { id: { in: idList } },
      include: articleInclude,
    });

    const order = new Map(idList.map((id, i) => [id, i]));
    articles.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    return {
      articles,
      hasMore,
    };
  }

  const effectiveSort = sort === "relevant" ? "newest" : sort;

  const orderBy: Prisma.ArticleOrderByWithRelationInput[] =
    effectiveSort === "rated"
      ? [{ fitScore: "desc" }, { publishedAt: "desc" }]
      : [{ publishedAt: "desc" }];

  const articles = await prisma.article.findMany({
    where: baseWhere,
    orderBy,
    take: limit + 1,
    skip: offset,
    include: articleInclude,
  });

  const hasMore = articles.length > limit;
  const trimmed = hasMore ? articles.slice(0, limit) : articles;

  return { articles: trimmed, hasMore };
}

export async function listHeroArticles(take = 5) {
  const highlighted = await prisma.article.findMany({
    where: { status: ArticleStatus.PUBLISHED, highlighted: true },
    orderBy: [{ publishedAt: "desc" }],
    take,
    include: articleInclude,
  });

  if (highlighted.length >= 3) return highlighted;

  const rest = await prisma.article.findMany({
    where: {
      status: ArticleStatus.PUBLISHED,
      id: { notIn: highlighted.map((a) => a.id) },
    },
    orderBy: [{ fitScore: "desc" }, { publishedAt: "desc" }],
    take: take - highlighted.length,
    include: articleInclude,
  });

  return [...highlighted, ...rest].slice(0, take);
}

export async function getArticleById(id: string) {
  return prisma.article.findFirst({
    where: { id, status: ArticleStatus.PUBLISHED },
    include: articleInclude,
  });
}

export async function listAllTags() {
  return prisma.tag.findMany({ orderBy: { label: "asc" } });
}
