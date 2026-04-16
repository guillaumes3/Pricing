"use client";

import useSWR from "swr";
import { PriceChart } from "@/components/PriceChart";
import { ProductsTable } from "@/components/products-table";
import { DashboardData } from "@/lib/dashboard-types";

type ProductDashboardClientProps = {
  initialData: DashboardData;
};

const fetcher = async (url: string): Promise<DashboardData> => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Impossible de recuperer les donnees dashboard.");
  }

  return response.json();
};

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

export function ProductDashboardClient({ initialData }: ProductDashboardClientProps) {
  const { data } = useSWR("/api/dashboard", fetcher, {
    fallbackData: initialData,
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true
  });

  const dashboard = data ?? initialData;
  const latestPoint = dashboard.priceHistory[dashboard.priceHistory.length - 1];
  const previousPoint = dashboard.priceHistory[dashboard.priceHistory.length - 2];
  const trend = latestPoint.ourPrice - previousPoint.ourPrice;
  const priceLeaders = dashboard.products.filter((product) => product.ourPrice <= product.competitorLow).length;
  const atRisk = dashboard.products.filter((product) => product.ourPrice > product.competitorLow).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Notre prix actuel</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(latestPoint.ourPrice, dashboard.currency)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Variation quotidienne</p>
          <p
            className={`mt-2 text-2xl font-semibold ${
              trend <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {trend > 0 ? "+" : ""}
            {formatCurrency(trend, dashboard.currency)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Produits leaders</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{priceLeaders}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Produits sous pression</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{atRisk}</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <article className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Evolution des prix</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Notre prix vs le prix concurrent le plus bas.
            </p>
          </div>
          <PriceChart data={dashboard.priceHistory} currency={dashboard.currency} />
        </article>

        <article className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Produits surveilles</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Tri par prix, filtre SKU/nom, pagination.
            </p>
          </div>
          <ProductsTable products={dashboard.products} currency={dashboard.currency} />
        </article>
      </section>

      <p className="text-right text-xs text-slate-500 dark:text-slate-400">
        Mise a jour: {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(dashboard.updatedAt))}
      </p>
    </div>
  );
}
