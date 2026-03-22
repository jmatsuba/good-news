export default function Loading() {
  return (
    <div className="min-h-screen bg-[#faf8f5] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl animate-pulse space-y-8">
        <div className="h-10 w-48 rounded-lg bg-stone-200/80" />
        <div className="h-4 max-w-md rounded bg-stone-200/60" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-64 rounded-2xl bg-stone-200/70 md:col-span-2" />
          <div className="h-64 rounded-2xl bg-stone-200/50" />
        </div>
        <div className="space-y-4">
          <div className="h-40 rounded-2xl bg-stone-200/60" />
          <div className="h-40 rounded-2xl bg-stone-200/60" />
        </div>
      </div>
    </div>
  );
}
