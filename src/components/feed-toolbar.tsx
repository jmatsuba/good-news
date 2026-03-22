"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useTransition } from "react";

type Sort = "newest" | "relevant" | "rated";

export function FeedToolbar() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const buildUrl = useCallback(
    (next: { q?: string; sort?: Sort; tag?: string | null }) => {
      const p = new URLSearchParams(sp.toString());
      const qVal = next.q !== undefined ? next.q : (sp.get("q") ?? "");
      if (qVal) p.set("q", qVal);
      else p.delete("q");

      const sortVal = next.sort ?? (sp.get("sort") as Sort | null) ?? "newest";
      if (sortVal && sortVal !== "newest") p.set("sort", sortVal);
      else p.delete("sort");

      const tagVal = next.tag !== undefined ? next.tag : sp.get("tag");
      if (tagVal) p.set("tag", tagVal);
      else p.delete("tag");

      p.delete("offset");
      const qs = p.toString();
      return qs ? `/?${qs}` : "/";
    },
    [sp],
  );

  const sort = (sp.get("sort") as Sort | null) ?? "newest";
  const qKey = sp.get("q") ?? "";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <form
        className="relative max-w-md flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          const q = inputRef.current?.value ?? "";
          startTransition(() => {
            router.push(buildUrl({ q }));
          });
        }}
      >
        <label htmlFor="search" className="sr-only">
          Search stories
        </label>
        <input
          ref={inputRef}
          id="search"
          name="q"
          type="search"
          key={qKey}
          defaultValue={qKey}
          placeholder="Search…"
          className="w-full rounded-full border border-stone-200 bg-white/80 px-5 py-2.5 text-sm text-stone-800 shadow-sm outline-none ring-0 transition placeholder:text-stone-400 focus:border-amber-400/80 focus:ring-2 focus:ring-amber-200/60"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-amber-50 transition hover:bg-stone-800"
          disabled={pending}
        >
          Search
        </button>
      </form>

      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-stone-500">Sort</span>
        <select
          aria-label="Sort articles"
          value={sort}
          onChange={(e) => {
            const next = e.target.value as Sort;
            startTransition(() => {
              router.push(buildUrl({ sort: next }));
            });
          }}
          className="rounded-full border border-stone-200 bg-white/90 px-3 py-2 text-sm text-stone-800 shadow-sm outline-none focus:border-amber-400/80 focus:ring-2 focus:ring-amber-200/60"
        >
          <option value="newest">Newest</option>
          <option value="relevant">Most relevant</option>
          <option value="rated">Highest rated</option>
        </select>
      </div>
    </div>
  );
}
