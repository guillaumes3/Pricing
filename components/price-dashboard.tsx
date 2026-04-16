"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { priceHistory, products } from "@/data/pricing-data";

type BadgeProps = {
  label: string;
  tone: "green" | "red" | "neutral";
};

function Badge({ label, tone }: BadgeProps) {
  const toneClasses =
    tone === "green"
      ? "bg-success-100 text-success-700"
      : tone === "red"
        ? "bg-danger-100 text-danger-700"
        : "bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneClasses}`}>
      {label}
    </span>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

export function PriceDashboard() {
  const latest = priceHistory[priceHistory.length - 1];
  const previous = priceHistory[priceHistory.length - 2];
  const trend = latest.ourPrice - previous.ourPrice;
  const productsAtRisk = products.filter((row) =>
    row.competitors.some((competitor) => competitor.current < competitor.previous)
  ).length;
  const cheapestCount = products.filter((row) => {
    const minCompetitor = Math.min(...row.competitors.map((competitor) => competitor.current));
    return row.ourPrice <= minCompetitor;
  }).length;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-10 sm:px-6 lg:px-10">
      <section className="mb-8 rounded-3xl border border-white/70 bg-white/75 p-6 shadow-floating backdrop-blur-md sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent-700">Pricing Intelligence</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">Dashboard Prix Produit</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
          Surveillance en temps réel des prix pour protéger la marge et garder le leadership tarifaire.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-white/80 bg-[var(--card-bg)] p-5 shadow-floating">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Notre Prix Actuel</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{formatCurrency(latest.ourPrice)}</p>
        </article>
        <article className="rounded-2xl border border-white/80 bg-[var(--card-bg)] p-5 shadow-floating">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Variation 24h</p>
          <p className={`mt-2 text-2xl font-semibold ${trend <= 0 ? "text-success-700" : "text-danger-700"}`}>
            {trend <= 0 ? "" : "+"}
            {formatCurrency(trend)}
          </p>
        </article>
        <article className="rounded-2xl border border-white/80 bg-[var(--card-bg)] p-5 shadow-floating">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Produits Les Moins Chers</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{cheapestCount}</p>
        </article>
        <article className="rounded-2xl border border-white/80 bg-[var(--card-bg)] p-5 shadow-floating">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Alertes Concurrence</p>
          <p className="mt-2 text-2xl font-semibold text-danger-700">{productsAtRisk}</p>
        </article>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <article className="rounded-2xl border border-white/80 bg-[var(--card-bg)] p-5 shadow-floating sm:p-6">
          <h2 className="text-lg font-semibold text-ink">Evolution du Prix Produit</h2>
          <p className="mt-1 text-sm text-slate-600">Comparaison entre notre prix et le meilleur prix concurrent.</p>

          <div className="mt-6 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="4 4" stroke="#DCE4EF" />
                <XAxis dataKey="day" tick={{ fill: "#4A5567", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#4A5567", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={46}
                  domain={["dataMin - 2", "dataMax + 2"]}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #E4EAF2",
                    backgroundColor: "#FFFFFF"
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="ourPrice"
                  name="Notre Prix"
                  stroke="#1A8DFF"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="competitorLow"
                  name="Prix Concurrent Bas"
                  stroke="#0E5FB0"
                  strokeDasharray="5 6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-white/80 bg-[var(--card-bg)] p-5 shadow-floating sm:p-6">
          <h2 className="text-lg font-semibold text-ink">Etat Concurrentiel</h2>
          <p className="mt-1 text-sm text-slate-600">
            Badge vert si nous sommes les moins chers. Badge rouge si un concurrent baisse son prix.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-3 py-2">Produit</th>
                  <th className="px-3 py-2">Notre Prix</th>
                  <th className="px-3 py-2">Meilleur Concurrent</th>
                  <th className="px-3 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {products.map((row) => {
                  const minCompetitor = Math.min(...row.competitors.map((competitor) => competitor.current));
                  const weAreCheapest = row.ourPrice <= minCompetitor;
                  const competitorDropped = row.competitors.some(
                    (competitor) => competitor.current < competitor.previous
                  );

                  return (
                    <tr key={row.sku} className="rounded-xl bg-white/80">
                      <td className="rounded-l-xl px-3 py-3 align-top">
                        <p className="font-semibold text-ink">{row.product}</p>
                        <p className="text-xs text-slate-500">{row.sku}</p>
                      </td>
                      <td className="px-3 py-3 font-medium text-ink">{formatCurrency(row.ourPrice)}</td>
                      <td className="px-3 py-3 font-medium text-ink">{formatCurrency(minCompetitor)}</td>
                      <td className="rounded-r-xl px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {weAreCheapest && <Badge tone="green" label="Nous sommes les moins chers" />}
                          {competitorDropped && <Badge tone="red" label="Concurrent en baisse" />}
                          {!weAreCheapest && !competitorDropped && <Badge tone="neutral" label="Stable" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  );
}
