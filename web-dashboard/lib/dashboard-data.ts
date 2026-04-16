import { DashboardData, DashboardPricePoint, DashboardProduct } from "@/lib/dashboard-types";

const BASE_HISTORY: DashboardPricePoint[] = [
  { day: "08 avr", ourPrice: 129, competitorLow: 132 },
  { day: "09 avr", ourPrice: 128, competitorLow: 131 },
  { day: "10 avr", ourPrice: 128, competitorLow: 129 },
  { day: "11 avr", ourPrice: 127, competitorLow: 128 },
  { day: "12 avr", ourPrice: 126, competitorLow: 127 },
  { day: "13 avr", ourPrice: 126, competitorLow: 126 },
  { day: "14 avr", ourPrice: 125, competitorLow: 126 },
  { day: "15 avr", ourPrice: 125, competitorLow: 124 }
];

const BASE_PRODUCTS: DashboardProduct[] = [
  { sku: "SKU-1001", name: "Casque Audio Pro X", ourPrice: 125, competitorLow: 124 },
  { sku: "SKU-1002", name: "Souris Wireless M8", ourPrice: 49, competitorLow: 50 },
  { sku: "SKU-1003", name: "Clavier Ultra Slim", ourPrice: 79, competitorLow: 79 },
  { sku: "SKU-1004", name: "Webcam 4K Stream", ourPrice: 99, competitorLow: 101 },
  { sku: "SKU-1005", name: "Support Laptop Ergo", ourPrice: 59, competitorLow: 62 },
  { sku: "SKU-1006", name: "Hub USB-C 8-en-1", ourPrice: 89, competitorLow: 87 },
  { sku: "SKU-1007", name: "Microphone Studio Lite", ourPrice: 139, competitorLow: 141 },
  { sku: "SKU-1008", name: "Ecran 27 QHD", ourPrice: 269, competitorLow: 265 }
];

function shiftValue(value: number, seed: number) {
  const direction = seed % 2 === 0 ? 1 : -1;
  const amplitude = seed % 3 === 0 ? 1 : 0;
  return value + direction * amplitude;
}

function buildLiveHistory(seed: number) {
  return BASE_HISTORY.map((point, index) => {
    if (index < BASE_HISTORY.length - 2) {
      return point;
    }

    return {
      ...point,
      ourPrice: shiftValue(point.ourPrice, seed + index),
      competitorLow: shiftValue(point.competitorLow, seed + index + 1)
    };
  });
}

function buildLiveProducts(seed: number) {
  return BASE_PRODUCTS.map((product, index) => {
    const ourPrice = shiftValue(product.ourPrice, seed + index);
    const competitorLow = shiftValue(product.competitorLow, seed + index + 1);

    return {
      ...product,
      ourPrice,
      competitorLow
    };
  });
}

export async function getDashboardSnapshot(): Promise<DashboardData> {
  const seed = new Date().getUTCMinutes();

  return {
    updatedAt: new Date().toISOString(),
    currency: "EUR",
    priceHistory: buildLiveHistory(seed),
    products: buildLiveProducts(seed)
  };
}
