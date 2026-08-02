import type { Product, ProductCategory } from "@/components/ProductCard";
import {
  RETAILERS,
  defaultWarranty,
  sortOffersByValue,
  type CardCondition,
  type MerchantOffer,
  type RetailerId,
} from "@/lib/catalog";

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

/**
 * A competing merchant's listing, expressed relative to the headline offer so
 * the fixtures stay readable. Several are deliberately cheaper on the sticker
 * but worse once shipping and cashback are counted — that's the case the
 * comparison table exists to make visible.
 */
type OfferSeed = {
  merchant: RetailerId;
  /** Added to the headline price. Negative = cheaper sticker. */
  delta: number;
  /** Defaults to the headline condition. */
  condition?: CardCondition;
  /** Flat shipping; omitted means free. */
  shipping?: number;
  /** Overrides the grade's implied coverage. */
  warranty?: string;
  stock?: string;
  returns?: string;
};

type Seed = Omit<
  Product,
  "cashback" | "priceHistory" | "offers" | "specs"
> & {
  /** [90 days ago, today] for the trend line. */
  trend: [number, number];
  /** [label, value] pairs for the product page's spec table. */
  specs: [string, string][];
  /** Merchants beyond the headline listing carried in the fields above. */
  competitors: OfferSeed[];
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
    specs: [
      ["Display", '13.6" Liquid Retina · 2560×1664'],
      ["Chip", "Apple M2 · 8-core CPU / 10-core GPU"],
      ["Memory", "16GB unified"],
      ["Storage", "512GB SSD"],
      ["Battery", "Up to 18 hours"],
    ],
    competitors: [
      {
        merchant: "amazon-warehouse",
        condition: "certified-refurbished",
        delta: 36,
        stock: "2 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "back-market",
        condition: "like-new",
        delta: -20,
        shipping: 25,
        warranty: "1-Year Back Market Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
      {
        merchant: "ebay",
        delta: 55,
        stock: "1 in stock",
        returns: "14-day returns",
      },
    ],
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
    specs: [
      ["Display", '15.6" FHD+ InfinityEdge · 500 nits'],
      ["Processor", "Intel Core i7-13700H"],
      ["Graphics", "NVIDIA GeForce RTX 4060 8GB"],
      ["Memory", "32GB DDR5-4800"],
      ["Storage", "1TB NVMe SSD"],
    ],
    competitors: [
      {
        merchant: "back-market",
        condition: "like-new",
        delta: -35,
        shipping: 45,
        warranty: "1-Year Back Market Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
      {
        merchant: "newegg",
        delta: 90,
        stock: "5 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "amazon-warehouse",
        condition: "open-box-excellent",
        delta: 44,
        stock: "1 in stock",
        returns: "30-day returns",
      },
    ],
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
    specs: [
      ["Display", '14" WUXGA IPS Touch · 400 nits'],
      ["Processor", "Intel Core Ultra 7 155U"],
      ["Memory", "32GB LPDDR5x (soldered)"],
      ["Storage", "1TB NVMe SSD"],
      ["Weight", "2.42 lb (1.10 kg)"],
    ],
    competitors: [
      {
        merchant: "back-market",
        condition: "like-new",
        delta: -15,
        shipping: 29,
        warranty: "1-Year Back Market Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
      {
        merchant: "ebay",
        delta: 32,
        shipping: 19,
        stock: "2 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "newegg",
        delta: 65,
        stock: "3 in stock",
        returns: "30-day returns",
      },
    ],
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
    specs: [
      ["Sensor", "33MP full-frame Exmor R CMOS"],
      ["Mount", "Sony E"],
      ["Video", "4K 60p · 10-bit 4:2:2"],
      ["ISO Range", "100–51,200 (expandable)"],
      ["Stabilization", "5-axis in-body · 5.5 stops"],
    ],
    competitors: [
      {
        merchant: "amazon-warehouse",
        condition: "like-new",
        delta: -30,
        shipping: 49,
        warranty: "6-Month Store Warranty",
        stock: "1 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "ebay",
        delta: 45,
        stock: "2 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "adorama",
        condition: "certified-refurbished",
        delta: 76,
        stock: "4 in stock",
        returns: "30-day returns",
      },
    ],
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
    specs: [
      ["Sensor", "24.2MP full-frame CMOS"],
      ["Mount", "Canon RF"],
      ["Video", "4K 60p oversampled · 6K RAW out"],
      ["Burst", "40 fps electronic shutter"],
      ["Stabilization", "5-axis in-body · up to 8 stops"],
    ],
    competitors: [
      {
        merchant: "adorama",
        delta: 60,
        stock: "3 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "best-buy",
        condition: "open-box-excellent",
        delta: 115,
        stock: "1 in stock",
        returns: "15-day returns",
      },
    ],
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
    specs: [
      ["Video", "5.3K 60p · 4K 120p"],
      ["Photo", "27MP still capture"],
      ["Stabilization", "HyperSmooth 6.0"],
      ["Waterproof", "33 ft (10 m) without housing"],
      ["Battery", "Enduro 1720mAh"],
    ],
    competitors: [
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -7,
        shipping: 15,
        warranty: "6-Month Seller Warranty",
        stock: "2 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "amazon-warehouse",
        delta: 18,
        stock: "4 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "back-market",
        condition: "certified-refurbished",
        delta: 26,
        stock: "In stock",
        returns: "30-day returns",
      },
    ],
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
    specs: [
      ["Drivers", "30mm carbon fiber composite"],
      ["Noise Cancelling", "Dual processor · 8 microphones"],
      ["Battery", "30 hours with ANC on"],
      ["Codecs", "LDAC · AAC · SBC"],
      ["Weight", "250 g"],
    ],
    competitors: [
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -9,
        shipping: 12,
        warranty: "6-Month Seller Warranty",
        stock: "3 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "amazon-warehouse",
        delta: 14,
        stock: "6 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "back-market",
        condition: "certified-refurbished",
        delta: 21,
        stock: "In stock",
        returns: "30-day returns",
      },
    ],
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
    specs: [
      ["Chip", "Apple H2"],
      ["Noise Cancelling", "2× Active Noise Cancellation"],
      ["Battery", "6 hrs · 30 hrs with case"],
      ["Case", "USB-C · MagSafe · speaker"],
      ["Water Resistance", "IP54 (buds and case)"],
    ],
    competitors: [
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -6,
        shipping: 9,
        warranty: "6-Month Seller Warranty",
        stock: "4 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "back-market",
        delta: 12,
        warranty: "1-Year Back Market Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
      {
        merchant: "best-buy",
        condition: "open-box-excellent",
        delta: 20,
        stock: "7 in stock",
        returns: "15-day returns",
      },
    ],
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
    specs: [
      ["Noise Cancelling", "CustomTune adaptive ANC"],
      ["Spatial Audio", "Bose Immersive Audio"],
      ["Battery", "24 hrs · 18 hrs immersive"],
      ["Codecs", "aptX Adaptive · AAC · SBC"],
      ["Weight", "250 g"],
    ],
    competitors: [
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -10,
        shipping: 14,
        warranty: "6-Month Seller Warranty",
        stock: "2 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "amazon-warehouse",
        delta: 11,
        stock: "3 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "best-buy",
        condition: "certified-refurbished",
        delta: 22,
        stock: "5 in stock",
        returns: "15-day returns",
      },
    ],
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
    specs: [
      ["Storage", "1TB custom NVMe SSD"],
      ["Optical Drive", "Ultra HD Blu-ray (detachable)"],
      ["Output", "4K 120Hz · 8K ready"],
      ["CPU", "8-core AMD Zen 2 @ 3.5GHz"],
      ["GPU", "10.28 TFLOPs RDNA 2"],
    ],
    competitors: [
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -12,
        shipping: 18,
        warranty: "6-Month Seller Warranty",
        stock: "3 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "best-buy",
        delta: 25,
        stock: "1 in stock",
        returns: "15-day returns",
      },
      {
        merchant: "gamestop",
        condition: "certified-refurbished",
        delta: 30,
        warranty: "1-Year GameStop Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
    ],
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
    specs: [
      ["Storage", "1TB custom NVMe SSD"],
      ["Optical Drive", "4K UHD Blu-ray"],
      ["Output", "4K 120Hz · 8K ready"],
      ["CPU", "8-core AMD Zen 2 @ 3.8GHz"],
      ["GPU", "12.15 TFLOPs RDNA 2"],
    ],
    competitors: [
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -8,
        shipping: 15,
        warranty: "6-Month Seller Warranty",
        stock: "2 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "walmart",
        condition: "open-box-excellent",
        delta: 14,
        stock: "3 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "gamestop",
        delta: 26,
        warranty: "1-Year GameStop Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
    ],
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
    specs: [
      ["Display", '7" OLED multi-touch'],
      ["Storage", "64GB internal · microSD expandable"],
      ["Battery", "4.5–9 hours"],
      ["Dock", "Wired LAN port included"],
      ["Joy-Con", "White · bundled pair"],
    ],
    competitors: [
      {
        merchant: "back-market",
        condition: "like-new",
        delta: -5,
        shipping: 12,
        warranty: "1-Year Back Market Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
      {
        merchant: "walmart",
        delta: 16,
        stock: "5 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "gamestop",
        condition: "certified-refurbished",
        delta: 20,
        warranty: "1-Year GameStop Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
    ],
  },
];

/**
 * Expands a seed into the full offer set: the headline listing plus every
 * competitor, each priced and ranked by total cost to the buyer.
 *
 * A competitor that names the headline merchant is dropped — two rows for one
 * store would collide on `id` and read as a duplicate listing.
 */
function buildOffers(seed: Seed): MerchantOffer[] {
  const headline: MerchantOffer = {
    id: `${seed.id}--${seed.retailer}`,
    merchant: seed.retailer,
    condition: seed.condition,
    warranty: defaultWarranty(seed.brand, seed.condition),
    price: seed.price,
    shipping: 0,
    cashback: cashback(seed.price),
    dealUrl: seed.dealUrl,
    stock: seed.inStock ?? "In stock",
    returns: "30-day returns",
  };

  const rivals = seed.competitors
    .filter((c) => c.merchant !== seed.retailer)
    .map((c) => {
      const condition = c.condition ?? seed.condition;
      const price = seed.price + c.delta;

      return {
        id: `${seed.id}--${c.merchant}`,
        merchant: c.merchant,
        condition,
        warranty: c.warranty ?? defaultWarranty(seed.brand, condition),
        price,
        shipping: c.shipping ?? 0,
        cashback: cashback(price),
        dealUrl: RETAILERS[c.merchant].home,
        stock: c.stock ?? "In stock",
        returns: c.returns ?? "30-day returns",
      } satisfies MerchantOffer;
    });

  return sortOffersByValue([headline, ...rivals]);
}

export const MOCK_PRODUCTS: Product[] = SEEDS.map((seed, i) => {
  const offers = buildOffers(seed);
  const best = offers[0];

  return {
    id: seed.id,
    brand: seed.brand,
    model: seed.model,
    category: seed.category,
    image: seed.image,
    gallery: seed.gallery,
    msrp: seed.msrp,
    // The card summarises the winning offer, so the two can never disagree —
    // even if a competitor is ever priced below the headline listing.
    retailer: best.merchant,
    condition: best.condition,
    price: best.price,
    dealUrl: best.dealUrl,
    inStock: best.stock,
    cashback: best.cashback,
    priceHistory: priceSeries(seed.trend[0], best.price, i + 1),
    specs: seed.specs.map(([label, value]) => ({ label, value })),
    offers,
  };
});

/** Catalog lookup for the product route. `undefined` for an unknown id. */
export const productById = (id: string): Product | undefined =>
  MOCK_PRODUCTS.find((p) => p.id === id);
