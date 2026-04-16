"use client";

import { ReactElement } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis
} from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { DashboardPricePoint } from "@/lib/dashboard-types";

type PriceChartProps = {
  data: DashboardPricePoint[];
  currency: string;
};

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

function CustomTooltip({
  active,
  payload,
  label,
  currency
}: TooltipProps<ValueType, NameType> & { currency: string }): ReactElement | null {
  if (!active || !payload || payload.length < 2) {
    return null;
  }

  const ourPrice = Number(payload.find((entry) => entry.dataKey === "ourPrice")?.value ?? 0);
  const competitorLow = Number(payload.find((entry) => entry.dataKey === "competitorLow")?.value ?? 0);
  const spread = ourPrice - competitorLow;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="font-medium text-slate-900 dark:text-slate-100">{label}</p>
      <p className="mt-1 text-slate-600 dark:text-slate-300">
        Notre prix: <span className="font-semibold">{formatCurrency(ourPrice, currency)}</span>
      </p>
      <p className="text-slate-600 dark:text-slate-300">
        Prix concurrent bas: <span className="font-semibold">{formatCurrency(competitorLow, currency)}</span>
      </p>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        Ecart: {spread > 0 ? "+" : ""}
        {formatCurrency(spread, currency)}
      </p>
    </div>
  );
}

export function PriceChart({ data, currency }: PriceChartProps) {
  return (
    <div className="h-[320px] w-full rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="rgb(203 213 225)" className="dark:stroke-slate-700" />
          <XAxis
            dataKey="day"
            tick={{ fill: "rgb(100 116 139)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "rgb(100 116 139)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} />
          <Line
            type="monotone"
            dataKey="ourPrice"
            name="Notre prix"
            stroke="rgb(37 99 235)"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="competitorLow"
            name="Prix concurrent bas"
            stroke="rgb(14 116 144)"
            strokeDasharray="6 4"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
