import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";

export type ArticleCardData = {
  id: string;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  imageUrl: string | null;
  tags: { slug: string; label: string }[];
};

type Props = {
  article: ArticleCardData;
  /** Large spotlight / grid cards */
  hero?: boolean;
  /** Small thumbnail + text row (e.g. Latest feed) */
  compact?: boolean;
};

export function ArticleCard({ article, hero = false, compact = false }: Props) {
  if (compact) {
    return (
      <article className="group relative flex gap-3 overflow-hidden rounded-xl border border-stone-200/60 bg-white/70 p-3 shadow-sm backdrop-blur-sm transition hover:border-amber-200/80 hover:shadow-md sm:gap-4 sm:p-3.5">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg sm:h-28 sm:w-28">
          {article.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt=""
              className="h-full w-full object-cover grayscale transition duration-500 ease-out group-hover:scale-[1.03] group-hover:grayscale-0"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100/80 via-stone-100 to-stone-200/80 text-stone-400">
              <span className="text-[10px] font-medium tracking-wide">Good News</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {article.tags.slice(0, 3).map((t) => (
              <span
                key={t.slug}
                className="rounded-full bg-stone-100/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-600"
              >
                {t.label}
              </span>
            ))}
          </div>
          <h2 className="font-serif text-base leading-snug tracking-tight text-stone-900 sm:text-[1.05rem]">
            <Link href={`/article/${article.id}`} className="after:absolute after:inset-0 after:rounded-xl">
              <span className="line-clamp-2">{article.title}</span>
            </Link>
          </h2>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-stone-600 sm:text-sm">{article.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500">
            <span className="truncate">{article.sourceName}</span>
            <time dateTime={article.publishedAt}>{formatRelativeTime(article.publishedAt)}</time>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 font-medium text-amber-800 underline-offset-4 hover:underline"
            >
              Source
            </a>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-stone-200/60 bg-white/70 shadow-sm backdrop-blur-sm transition hover:border-amber-200/80 hover:shadow-md ${
        hero ? "md:grid md:grid-cols-2 md:gap-0" : ""
      }`}
    >
      <div className={`relative ${hero ? "aspect-[16/10] md:aspect-auto md:min-h-[220px]" : "aspect-[16/10]"}`}>
        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.imageUrl}
            alt=""
            className="h-full w-full object-cover grayscale transition duration-500 ease-out group-hover:scale-[1.02] group-hover:grayscale-0"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100/80 via-stone-100 to-stone-200/80 text-stone-400">
            <span className="text-sm font-medium tracking-wide">Good News</span>
          </div>
        )}
      </div>
      <div className={`flex flex-col justify-center p-5 ${hero ? "md:p-8" : ""}`}>
        <div className="mb-2 flex flex-wrap gap-2">
          {article.tags.map((t) => (
            <span
              key={t.slug}
              className="rounded-full bg-stone-100/90 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-stone-600"
            >
              {t.label}
            </span>
          ))}
        </div>
        <h2
          className={`font-serif text-stone-900 ${hero ? "text-2xl md:text-3xl" : "text-lg"} leading-snug tracking-tight`}
        >
          <Link href={`/article/${article.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
            {article.title}
          </Link>
        </h2>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-600">{article.summary}</p>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-stone-500">
          <span>{article.sourceName}</span>
          <time dateTime={article.publishedAt}>{formatRelativeTime(article.publishedAt)}</time>
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 mt-3 inline-flex w-fit text-xs font-medium text-amber-800 underline-offset-4 hover:underline"
        >
          Read source
        </a>
      </div>
    </article>
  );
}
