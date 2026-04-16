"use client";

import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-12 sm:px-6">
      <section className="w-full rounded-xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-900/60 dark:bg-slate-900">
        <p className="text-xs uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400">Erreur API</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">Impossible de charger le dashboard</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          L&apos;appel serveur vers l&apos;API NestJS a echoue. Verifiez que `http://localhost:3001` est joignable et que les identifiants
          d&apos;acces (JWT/API key) sont correctement configures.
        </p>
        <p className="mt-2 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {error.message}
        </p>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Reessayer
          </button>
        </div>
      </section>
    </main>
  );
}
