export type DashboardPricePoint = {
  day: string;
  ourPrice: number;
  competitorLow: number;
};

export type DashboardProduct = {
  sku: string;
  name: string;
  ourPrice: number;
  competitorLow: number;
};

export type DashboardData = {
  updatedAt: string;
  currency: "EUR";
  priceHistory: DashboardPricePoint[];
  products: DashboardProduct[];
};
