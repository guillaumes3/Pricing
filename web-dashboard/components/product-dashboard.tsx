import { ProductDashboardClient } from "@/components/product-dashboard-client";
import { getDashboardSnapshot } from "@/lib/dashboard-data";

export async function ProductDashboard() {
  const initialData = await getDashboardSnapshot();

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <section className="mb-6 rounded-xl border border-slate-200 bg-white px-5 py-6 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pricing intelligence</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">Dashboard de veille tarifaire</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Vue SaaS minimaliste pour suivre l'evolution de nos prix face au concurrent le plus agressif.
        </p>
      </section>

      <ProductDashboardClient initialData={initialData} />
    </main>
  );
}
