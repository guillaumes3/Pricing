import { PriceChart } from "@/components/PriceChart";
import { ProductsTable } from "@/components/products-table";
import { DashboardData } from "@/lib/dashboard-types";

const DEFAULT_API_BASE_URL = "http://localhost:3001";
const DEFAULT_PRODUCT_ID = 42;

export const dynamic = "force-dynamic";

type ApiChartPoint = {
  x: string;
  y: number;
};

type ApiPriceHistoryResponse = {
  productId: number;
  currency: string;
  points: ApiChartPoint[];
  summary: {
    min: number;
    max: number;
    latest: number;
    firstRecordedAt: string;
    lastRecordedAt: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiChartPoint(value: unknown): value is ApiChartPoint {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.x === "string" && typeof value.y === "number";
}

function isApiPriceHistoryResponse(value: unknown): value is ApiPriceHistoryResponse {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.productId !== "number" || typeof value.currency !== "string") {
    return false;
  }

  if (!Array.isArray(value.points) || !value.points.every(isApiChartPoint)) {
    return false;
  }

  if (!isRecord(value.summary)) {
    return false;
  }

  return (
    typeof value.summary.min === "number" &&
    typeof value.summary.max === "number" &&
    typeof value.summary.latest === "number" &&
    typeof value.summary.firstRecordedAt === "string" &&
    typeof value.summary.lastRecordedAt === "string"
  );
}

function formatCurrency(value: number, currency: DashboardData["currency"]) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

function toDashboardData(apiResponse: ApiPriceHistoryResponse): DashboardData {
  if (apiResponse.points.length === 0) {
    throw new Error("L'API a retourne une serie vide pour le produit demande.");
  }

  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short"
  });

  let rollingCompetitorLow = Number.POSITIVE_INFINITY;
  const priceHistory = apiResponse.points.map((point) => {
    rollingCompetitorLow = Math.min(rollingCompetitorLow, point.y);

    return {
      day: formatter.format(new Date(point.x)),
      ourPrice: point.y,
      competitorLow: rollingCompetitorLow
    };
  });

  const currency: DashboardData["currency"] = apiResponse.currency === "EUR" ? "EUR" : "EUR";
  const latestPrice = apiResponse.summary.latest;
  const benchmarkLow = apiResponse.summary.min;

  return {
    updatedAt: apiResponse.summary.lastRecordedAt,
    currency,
    priceHistory,
    products: [
      {
        sku: `PRODUCT-${apiResponse.productId}`,
        name: `Produit #${apiResponse.productId}`,
        ourPrice: latestPrice,
        competitorLow: benchmarkLow
      }
    ]
  };
}

async function getDashboardData(): Promise<DashboardData> {
  const apiBaseUrl = process.env.PRICING_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const rawProductId = process.env.PRICING_DASHBOARD_PRODUCT_ID ?? String(DEFAULT_PRODUCT_ID);
  const productId = Number(rawProductId);

  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error("La variable PRICING_DASHBOARD_PRODUCT_ID doit contenir un entier positif.");
  }

  const endpoint = new URL(`/prices/${productId}/history`, apiBaseUrl);
  const headers = new Headers({
    Accept: "application/json"
  });

  const jwtToken = process.env.PRICING_API_JWT;
  if (jwtToken) {
    headers.set("Authorization", `Bearer ${jwtToken}`);
  }

  const apiKey = process.env.SCRAPER_API_KEY;
  if (apiKey) {
    headers.set("x-api-key", apiKey);
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Echec API NestJS (${response.status} ${response.statusText}) sur ${endpoint.toString()}.`);
  }

  const payload: unknown = await response.json();

  if (!isApiPriceHistoryResponse(payload)) {
    throw new Error("Le format de reponse NestJS ne correspond pas au schema attendu.");
  }

  return toDashboardData(payload);
}

export default async function Home() {
  const dashboard = await getDashboardData();

  const latestPoint = dashboard.priceHistory[dashboard.priceHistory.length - 1];
  const previousPoint = dashboard.priceHistory[Math.max(dashboard.priceHistory.length - 2, 0)];
  const trend = latestPoint.ourPrice - previousPoint.ourPrice;
  const priceLeaders = dashboard.products.filter((product) => product.ourPrice <= product.competitorLow).length;
  const atRisk = dashboard.products.filter((product) => product.ourPrice > product.competitorLow).length;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <section className="mb-6 rounded-xl border border-slate-200 bg-white px-5 py-6 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pricing intelligence</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">Dashboard de veille tarifaire</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Donnees chargees en React Server Components depuis l&apos;API NestJS locale.
        </p>
      </section>

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
                Prix observe du produit et reference basse glissante.
              </p>
            </div>
            <PriceChart data={dashboard.priceHistory} currency={dashboard.currency} />
          </article>

          <article className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Produits surveilles</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Vue table derivee de la reponse API du produit demande.
              </p>
            </div>
            <ProductsTable products={dashboard.products} currency={dashboard.currency} />
          </article>
        </section>

        <p className="text-right text-xs text-slate-500 dark:text-slate-400">
          Mise a jour: {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(dashboard.updatedAt))}
        </p>
      </div>
    </main>
  );
}
