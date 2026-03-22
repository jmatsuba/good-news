import Link from "next/link";
import { listArticles, listAllTags, listHeroArticles, type ArticleSort } from "@/lib/articles";
import { ArticleCard, type ArticleCardData } from "@/components/article-card";
import { CategoryChips } from "@/components/category-chips";
import { FeedToolbar } from "@/components/feed-toolbar";

type SearchParams = {
  q?: string;
  tag?: string;
  sort?: string;
  offset?: string;
};

function toCard(a: {
  id: string;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  publishedAt: Date;
  imageUrl: string | null;
  tags: { tag: { slug: string; label: string } }[];
}): ArticleCardData {
  return {
    id: a.id,
    title: a.title,
    summary: a.summary,
    url: a.url,
    sourceName: a.sourceName,
    publishedAt: a.publishedAt.toISOString(),
    imageUrl: a.imageUrl,
    tags: a.tags.map((t) => ({ slug: t.tag.slug, label: t.tag.label })),
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const tag = sp.tag?.trim() || undefined;
  const sort = (sp.sort as ArticleSort | undefined) ?? "newest";
  const offset = Math.max(0, Number(sp.offset) || 0);
  const limit = 20;

  const sortSafe: ArticleSort =
    sort === "relevant" || sort === "rated" || sort === "newest" ? sort : "newest";

  const [hero, tags] = await Promise.all([listHeroArticles(5), listAllTags()]);

  const showSpotlight = offset === 0 && !q && !tag;
  const heroIds = hero.map((h) => h.id);

  const feed = await listArticles({
    q,
    tag,
    sort: sortSafe,
    limit,
    offset,
    excludeIds: showSpotlight ? heroIds : undefined,
  });

  const tagItems = tags.map((t) => ({ slug: t.slug, label: t.label }));

  const nextParams = new URLSearchParams();
  if (q) nextParams.set("q", q);
  if (tag) nextParams.set("tag", tag);
  if (sort && sort !== "newest") nextParams.set("sort", sort);
  if (feed.hasMore) nextParams.set("offset", String(offset + limit));
  const nextHref = nextParams.toString() ? `/?${nextParams.toString()}` : "/";

  return (
    <div className="min-h-screen bg-[#faf8f5] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-100/40 via-transparent to-transparent">
      <header className="border-b border-stone-200/60 bg-white/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-amber-800/80">Curated calm</p>
            <h1 className="font-serif text-4xl tracking-tight text-stone-900 sm:text-5xl">Good News</h1>
            <p className="max-w-xl text-sm leading-relaxed text-stone-600">
              Uplifting stories from trusted feeds—filtered for positivity, lower sensationalism, and a steadier tone.
            </p>
          </div>
          <FeedToolbar />
          <CategoryChips
            tags={tagItems}
            activeSlug={tag ?? null}
            preserve={{ q, sort: sort !== "newest" ? sort : undefined }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {showSpotlight && (
          <section className="mb-12" aria-labelledby="spotlight-heading">
            <h2 id="spotlight-heading" className="mb-6 font-serif text-2xl text-stone-900">
              Spotlight
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {hero.slice(0, 1).map((a) => (
                <div key={a.id} className="md:col-span-2 lg:col-span-3">
                  <ArticleCard article={toCard(a)} hero />
                </div>
              ))}
              {hero.slice(1).map((a) => (
                <ArticleCard key={a.id} article={toCard(a)} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="feed-heading">
          <h2 id="feed-heading" className="mb-6 font-serif text-2xl text-stone-900">
            {q ? "Search results" : "Latest"}
          </h2>
          {feed.articles.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-stone-300/80 bg-white/50 px-6 py-12 text-center text-sm text-stone-600">
              No stories match yet. Try another search or category.
            </p>
          ) : (
            <ul className="flex flex-col gap-5">
              {feed.articles.map((a) => (
                <li key={a.id}>
                  <ArticleCard article={toCard(a)} />
                </li>
              ))}
            </ul>
          )}

          {feed.hasMore && (
            <div className="mt-10 flex justify-center">
              <Link
                href={nextHref}
                className="rounded-full border border-stone-300 bg-white px-6 py-2.5 text-sm font-medium text-stone-800 shadow-sm transition hover:border-amber-300 hover:bg-amber-50/60"
                prefetch
              >
                Load more
              </Link>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-stone-200/60 py-8 text-center text-xs text-stone-500">
        Links open original publishers. Summaries are excerpts for discovery.
      </footer>
    </div>
  );
}
