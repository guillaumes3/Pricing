export interface ChartPoint {
  x: string;
  y: number;
}

export interface PriceHistoryChartResponse {
  productId: number;
  currency: string;
  points: ChartPoint[];
  summary: {
    min: number;
    max: number;
    latest: number;
    firstRecordedAt: string;
    lastRecordedAt: string;
  };
}
