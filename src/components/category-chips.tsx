import Link from "next/link";

export type TagItem = { slug: string; label: string };

type Props = {
  tags: TagItem[];
  activeSlug?: string | null;
  /** Keep search/sort when switching categories */
  preserve?: { q?: string; sort?: string };
};

function hrefForTag(slug: string | null, preserve?: Props["preserve"]) {
  const p = new URLSearchParams();
  if (preserve?.q) p.set("q", preserve.q);
  if (preserve?.sort && preserve.sort !== "newest") p.set("sort", preserve.sort);
  if (slug) p.set("tag", slug);
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

export function CategoryChips({ tags, activeSlug, preserve }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip href={hrefForTag(null, preserve)} active={!activeSlug}>
        All
      </Chip>
      {tags.map((t) => (
        <Chip key={t.slug} href={hrefForTag(t.slug, preserve)} active={activeSlug === t.slug}>
          {t.label}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm transition ${
        active
          ? "bg-stone-900 text-amber-50 shadow-sm"
          : "border border-stone-200/80 bg-white/60 text-stone-700 hover:border-amber-300/60 hover:bg-amber-50/50"
      }`}
    >
      {children}
    </Link>
  );
}
