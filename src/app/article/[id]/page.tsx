import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleById } from "@/lib/articles";
import { formatRelativeTime } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return { title: "Story" };
  return {
    title: `${article.title} · Good News`,
    description: article.summary.slice(0, 160),
    openGraph: {
      title: article.title,
      description: article.summary.slice(0, 200),
      type: "article",
      ...(article.imageUrl ? { images: [{ url: article.imageUrl }] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) notFound();

  return (
    <article className="mx-auto min-h-screen max-w-3xl bg-[#faf8f5] px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="mb-8 inline-flex text-sm font-medium text-amber-900/80 underline-offset-4 hover:underline"
      >
        ← Back
      </Link>

      <div className="mb-6 flex flex-wrap gap-2">
        {article.tags.map((t) => (
          <span
            key={t.tag.slug}
            className="rounded-full bg-stone-200/80 px-3 py-1 text-xs font-medium uppercase tracking-wider text-stone-700"
          >
            {t.tag.label}
          </span>
        ))}
      </div>

      <h1 className="font-serif text-3xl leading-tight tracking-tight text-stone-900 sm:text-4xl">{article.title}</h1>
      <p className="mt-3 text-sm text-stone-500">
        {article.sourceName} · <time dateTime={article.publishedAt.toISOString()}>{formatRelativeTime(article.publishedAt.toISOString())}</time>
      </p>

      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          className="mt-8 w-full rounded-2xl object-cover shadow-sm"
        />
      )}

      <p className="mt-8 text-lg leading-relaxed text-stone-700">{article.summary}</p>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-10 inline-flex rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-amber-50 transition hover:bg-stone-800"
      >
        Read full article
      </a>
    </article>
  );
}
