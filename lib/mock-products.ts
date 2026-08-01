import type { Product, ProductCategory } from "@/components/ProductCard";

/** VIP wallet rate — every mock cashback figure is derived from it. */
export const CASHBACK_RATE = 0.03;

const cashback = (price: number) =>
  Math.round(price * CASHBACK_RATE * 100) / 100;

/**
 * Deterministic 90-day series — no RNG, so server and client render the same
 * sparkline and hydration stays clean.
 */
function priceSeries(start: number, end: number, seed: number): number[] {
  return Array.from({ length: 90 }, (_, i) => {
    const t = i / 89;
    const drift = start + (end - start) * t;
    const wobble =
      Math.sin(i * 0.31 + seed) * (start * 0.012) +
      Math.sin(i * 0.11 + seed * 2) * (start * 0.008);
    return Math.round(drift + wobble);
  });
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  laptops: "Laptops",
  cameras: "Cameras",
  headphones: "Headphones",
  consoles: "Gaming Consoles",
};

type Seed = Omit<Product, "cashback" | "priceHistory"> & {
  /** [90 days ago, today] for the trend line. */
  trend: [number, number];
};

const SEEDS: Seed[] = [
  /* Laptops -------------------------------------------------------- */
  {
    id: "apple-mba-m2-16-512",
    brand: "Apple",
    model: 'MacBook Air 13" M2 · 16GB / 512GB',
    category: "laptops",
    retailer: "best-buy",
    condition: "open-box-excellent",
    msrp: 1199,
    price: 849,
    trend: [969, 849],
    dealUrl: "https://www.bestbuy.com/",
    inStock: "4 in stock",
  },
  {
    id: "dell-xps-15-9530",
    brand: "Dell",
    model: "XPS 15 9530 · i7 / 32GB / RTX 4060",
    category: "laptops",
    retailer: "ebay",
    condition: "certified-refurbished",
    msrp: 2099,
    price: 1399,
    trend: [1549, 1399],
    dealUrl: "https://www.ebay.com/",
    inStock: "2 in stock",
  },
  {
    id: "lenovo-x1-carbon-g12",
    brand: "Lenovo",
    model: "ThinkPad X1 Carbon Gen 12 · Ultra 7",
    category: "laptops",
    retailer: "amazon-warehouse",
    condition: "certified-refurbished",
    msrp: 1749,
    price: 1109,
    trend: [1189, 1109],
    dealUrl: "https://www.amazon.com/",
  },

  /* Cameras -------------------------------------------------------- */
  {
    id: "sony-a7-iv-body",
    brand: "Sony",
    model: "Alpha a7 IV Mirrorless · Body Only",
    category: "cameras",
    retailer: "best-buy",
    condition: "open-box-excellent",
    msrp: 2499,
    price: 1899,
    trend: [1999, 1899],
    dealUrl: "https://www.bestbuy.com/",
    inStock: "3 in stock",
  },
  {
    id: "canon-eos-r6-ii",
    brand: "Canon",
    model: "EOS R6 Mark II · Body Only",
    category: "cameras",
    retailer: "ebay",
    condition: "certified-refurbished",
    msrp: 2499,
    price: 1749,
    trend: [1699, 1749],
    dealUrl: "https://www.ebay.com/",
    inStock: "1 in stock",
  },
  {
    id: "gopro-hero12-black",
    brand: "GoPro",
    model: "HERO12 Black Action Camera",
    category: "cameras",
    retailer: "walmart",
    condition: "open-box-excellent",
    msrp: 399,
    price: 249,
    trend: [289, 249],
    dealUrl: "https://www.walmart.com/",
    inStock: "6 in stock",
  },

  /* Headphones ----------------------------------------------------- */
  {
    id: "sony-wh1000xm5",
    brand: "Sony",
    model: "WH-1000XM5 Noise Cancelling",
    category: "headphones",
    retailer: "best-buy",
    condition: "open-box-excellent",
    msrp: 399,
    price: 268,
    trend: [318, 268],
    dealUrl: "https://www.bestbuy.com/",
    inStock: "8 in stock",
  },
  {
    id: "apple-airpods-pro-2",
    brand: "Apple",
    model: "AirPods Pro 2 · USB-C",
    category: "headphones",
    retailer: "amazon-warehouse",
    condition: "certified-refurbished",
    msrp: 249,
    price: 169,
    trend: [189, 169],
    dealUrl: "https://www.amazon.com/",
    inStock: "5 in stock",
  },
  {
    id: "bose-qc-ultra",
    brand: "Bose",
    model: "QuietComfort Ultra Headphones",
    category: "headphones",
    retailer: "walmart",
    condition: "open-box-excellent",
    msrp: 429,
    price: 289,
    trend: [279, 289],
    dealUrl: "https://www.walmart.com/",
  },

  /* Gaming consoles ------------------------------------------------ */
  {
    id: "sony-ps5-slim-disc",
    brand: "Sony",
    model: "PlayStation 5 Slim · Disc Edition",
    category: "consoles",
    retailer: "walmart",
    condition: "open-box-excellent",
    msrp: 499,
    price: 379,
    trend: [429, 379],
    dealUrl: "https://www.walmart.com/",
    inStock: "2 in stock",
  },
  {
    id: "xbox-series-x-1tb",
    brand: "Microsoft",
    model: "Xbox Series X · 1TB",
    category: "consoles",
    retailer: "best-buy",
    condition: "certified-refurbished",
    msrp: 499,
    price: 359,
    trend: [399, 359],
    dealUrl: "https://www.bestbuy.com/",
    inStock: "4 in stock",
  },
  {
    id: "nintendo-switch-oled",
    brand: "Nintendo",
    model: "Switch OLED · White Joy-Con",
    category: "consoles",
    retailer: "ebay",
    condition: "open-box-excellent",
    msrp: 349,
    price: 249,
    trend: [279, 249],
    dealUrl: "https://www.ebay.com/",
    inStock: "3 in stock",
  },
];

export const MOCK_PRODUCTS: Product[] = SEEDS.map(
  ({ trend, ...product }, i) => ({
    ...product,
    cashback: cashback(product.price),
    priceHistory: priceSeries(trend[0], trend[1], i + 1),
  }),
);
