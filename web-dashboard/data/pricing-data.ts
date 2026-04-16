export type PriceHistoryPoint = {
  day: string;
  ourPrice: number;
  competitorLow: number;
};

export type Competitor = {
  name: string;
  current: number;
  previous: number;
};

export type ProductRow = {
  sku: string;
  product: string;
  ourPrice: number;
  competitors: Competitor[];
};

export const priceHistory: PriceHistoryPoint[] = [
  { day: "08 Avr", ourPrice: 129, competitorLow: 132 },
  { day: "09 Avr", ourPrice: 128, competitorLow: 131 },
  { day: "10 Avr", ourPrice: 128, competitorLow: 129 },
  { day: "11 Avr", ourPrice: 127, competitorLow: 128 },
  { day: "12 Avr", ourPrice: 126, competitorLow: 127 },
  { day: "13 Avr", ourPrice: 126, competitorLow: 126 },
  { day: "14 Avr", ourPrice: 125, competitorLow: 126 },
  { day: "15 Avr", ourPrice: 125, competitorLow: 124 }
];

export const products: ProductRow[] = [
  {
    sku: "SKU-1001",
    product: "Casque Audio Pro X",
    ourPrice: 125,
    competitors: [
      { name: "Shopio", current: 127, previous: 129 },
      { name: "DealMarket", current: 124, previous: 127 },
      { name: "PrixZone", current: 129, previous: 129 }
    ]
  },
  {
    sku: "SKU-1002",
    product: "Souris Wireless M8",
    ourPrice: 49,
    competitors: [
      { name: "Shopio", current: 52, previous: 52 },
      { name: "DealMarket", current: 51, previous: 53 },
      { name: "PrixZone", current: 50, previous: 50 }
    ]
  },
  {
    sku: "SKU-1003",
    product: "Clavier Ultra Slim",
    ourPrice: 79,
    competitors: [
      { name: "Shopio", current: 79, previous: 82 },
      { name: "DealMarket", current: 82, previous: 82 },
      { name: "PrixZone", current: 81, previous: 83 }
    ]
  },
  {
    sku: "SKU-1004",
    product: "Webcam 4K Stream",
    ourPrice: 99,
    competitors: [
      { name: "Shopio", current: 103, previous: 104 },
      { name: "DealMarket", current: 101, previous: 101 },
      { name: "PrixZone", current: 102, previous: 103 }
    ]
  }
];
