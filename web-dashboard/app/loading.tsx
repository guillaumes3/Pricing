function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-800/80 ${className}`} />;
}

export default function Loading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <section className="mb-6 rounded-xl border border-slate-200 bg-white px-5 py-6 dark:border-slate-800 dark:bg-slate-900">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="mt-3 h-10 w-80" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      </section>

      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <article key={index} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-3 h-8 w-24" />
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <article className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="h-6 w-52" />
              <Skeleton className="mt-2 h-4 w-64" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="h-[320px] w-full" />
            </div>
          </article>

          <article className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="h-6 w-52" />
              <Skeleton className="mt-2 h-4 w-64" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="mb-4 h-9 w-full max-w-xs" />
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="mb-2 h-10 w-full" />
              ))}
            </div>
          </article>
        </section>

        <div className="flex justify-end">
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    </main>
  );
}
