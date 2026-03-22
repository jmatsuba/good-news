import { ArticleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Props = { searchParams: Promise<{ secret?: string }> };

export default async function RejectedAdminPage({ searchParams }: Props) {
  const sp = await searchParams;
  const expected = process.env.INGEST_SECRET;
  if (!expected || sp.secret !== expected) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-stone-600">
        Not available. Set <code className="rounded bg-stone-100 px-1">INGEST_SECRET</code> and pass{" "}
        <code className="rounded bg-stone-100 px-1">?secret=…</code> to view rejected samples.
      </div>
    );
  }

  const rows = await prisma.article.findMany({
    where: { status: ArticleStatus.REJECTED },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-serif text-2xl text-stone-900">Rejected (last 50)</h1>
      <p className="mt-2 text-sm text-stone-600">For debugging classification thresholds.</p>
      <ul className="mt-8 space-y-6">
        {rows.map((a) => (
          <li key={a.id} className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
            <p className="font-medium text-stone-900">{a.title}</p>
            <p className="mt-1 text-xs text-stone-500">{a.url}</p>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-stone-50 p-2 text-xs text-stone-700">
              {JSON.stringify(a.classificationJson, null, 2)}
            </pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
