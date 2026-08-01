import { MOCK_PRODUCTS } from "@/lib/mock-products";
import type { CardCondition, ProductCategory, RetailerId } from "@/lib/catalog";

/**
 * Seed fixtures for /api/seed. Product records are derived from the same
 * catalog the UI renders, so seeded data and mock data can't diverge.
 */

const PASSWORD = "ReSmart!Demo2026";

export type SeedPerson = {
  email: string;
  password: string;
  fullName: string;
  role: "user" | "merchant" | "admin";
};

export type SeedMerchant = SeedPerson & {
  businessName: string;
  category: string;
  status: "approved" | "pending";
  commissionRate: number;
  docs: {
    businessLicense: "verified" | "pending" | "missing" | "rejected";
    taxId: "verified" | "pending" | "missing" | "rejected";
    resellerCert: "verified" | "pending" | "missing" | "rejected";
  };
  adBalance: number;
};

export const SEED_ADMIN: SeedPerson = {
  email: "admin@resmart.ai",
  password: PASSWORD,
  fullName: "Platform Admin",
  role: "admin",
};

/** 3 approved + 2 pending, as the fixture spec requires. */
export const SEED_MERCHANTS: SeedMerchant[] = [
  {
    email: "ops@northgate-electronics.com",
    password: PASSWORD,
    fullName: "Dana Okafor",
    role: "merchant",
    businessName: "Northgate Electronics",
    category: "Laptops · Consoles",
    status: "approved",
    commissionRate: 0.1,
    docs: { businessLicense: "verified", taxId: "verified", resellerCert: "verified" },
    adBalance: 1284.5,
  },
  {
    email: "hello@cascadecamera.co",
    password: PASSWORD,
    fullName: "Iris Lindqvist",
    role: "merchant",
    businessName: "Cascade Camera Exchange",
    category: "Cameras",
    status: "approved",
    commissionRate: 0.09,
    docs: { businessLicense: "verified", taxId: "verified", resellerCert: "verified" },
    adBalance: 742.15,
  },
  {
    email: "accounts@baylineaudio.com",
    password: PASSWORD,
    fullName: "Theo Marchetti",
    role: "merchant",
    businessName: "Bayline Audio Outlet",
    category: "Headphones",
    status: "approved",
    commissionRate: 0.1,
    docs: { businessLicense: "verified", taxId: "verified", resellerCert: "verified" },
    adBalance: 318.0,
  },
  {
    email: "partners@tristaterefurb.net",
    password: PASSWORD,
    fullName: "Renée Adeyemi",
    role: "merchant",
    businessName: "TriState Refurb Partners",
    category: "Laptops",
    status: "pending",
    commissionRate: 0.1,
    docs: { businessLicense: "verified", taxId: "verified", resellerCert: "pending" },
    adBalance: 0,
  },
  {
    email: "admin@pixelpeaktrading.biz",
    password: PASSWORD,
    fullName: "Gus Halloran",
    role: "merchant",
    businessName: "Pixel Peak Trading",
    category: "Consoles",
    status: "pending",
    commissionRate: 0.1,
    docs: { businessLicense: "rejected", taxId: "missing", resellerCert: "missing" },
    adBalance: 0,
  },
];

export const SEED_SHOPPERS: (SeedPerson & { vip: boolean })[] = [
  { email: "alex.rivera@example.com", password: PASSWORD, fullName: "Alex Rivera", role: "user", vip: true },
  { email: "priya.raman@example.com", password: PASSWORD, fullName: "Priya Raman", role: "user", vip: true },
  { email: "dana.w@example.com", password: PASSWORD, fullName: "Dana Whitfield", role: "user", vip: true },
  { email: "m.bell@example.com", password: PASSWORD, fullName: "Marcus Bell", role: "user", vip: false },
  { email: "kai.o@example.com", password: PASSWORD, fullName: "Kai Oyelaran", role: "user", vip: false },
];

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export type SeedProduct = {
  brand: string;
  model: string;
  category: ProductCategory;
  condition: CardCondition;
  retailer: RetailerId;
  msrp: number;
  price: number;
  stock: number;
  dealUrl: string;
  priceHistory: number[];
  /** Index into SEED_MERCHANTS — only approved merchants own listings. */
  merchantIndex: 0 | 1 | 2;
};

/** Three beyond the 12 in the shared catalog, to reach the required 15. */
const EXTRA: Omit<SeedProduct, "priceHistory">[] = [
  {
    brand: "Apple",
    model: 'iPad Pro 11" M4 · 256GB Wi-Fi',
    category: "laptops",
    condition: "open-box-excellent",
    retailer: "best-buy",
    msrp: 999,
    price: 749,
    stock: 5,
    dealUrl: "https://www.bestbuy.com/site/ipad-pro-11-m4",
    merchantIndex: 0,
  },
  {
    brand: "Fujifilm",
    model: "X-T5 Mirrorless · Body Only",
    category: "cameras",
    condition: "certified-refurbished",
    retailer: "ebay",
    msrp: 1699,
    price: 1179,
    stock: 2,
    dealUrl: "https://www.ebay.com/itm/fujifilm-x-t5",
    merchantIndex: 1,
  },
  {
    brand: "Sennheiser",
    model: "Momentum 4 Wireless",
    category: "headphones",
    condition: "open-box-excellent",
    retailer: "walmart",
    msrp: 379,
    price: 219,
    stock: 8,
    dealUrl: "https://www.walmart.com/ip/sennheiser-momentum-4",
    merchantIndex: 2,
  },
];

/** Deterministic 90-day series so re-seeding produces identical history. */
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

/** Round-robin the catalog across the three approved merchants. */
const merchantFor = (i: number) => (i % 3) as 0 | 1 | 2;

export const SEED_PRODUCTS: SeedProduct[] = [
  ...MOCK_PRODUCTS.map((p, i) => ({
    brand: p.brand,
    model: p.model,
    category: p.category,
    condition: p.condition,
    retailer: p.retailer,
    msrp: p.msrp,
    price: p.price,
    stock: Number((p.inStock ?? "3").replace(/\D/g, "")) || 3,
    dealUrl: p.dealUrl,
    priceHistory: p.priceHistory,
    merchantIndex: merchantFor(i),
  })),
  ...EXTRA.map((p, i) => ({
    ...p,
    priceHistory: priceSeries(
      Math.round(p.price * 1.12),
      p.price,
      i + 13,
    ),
  })),
];

/* ------------------------------------------------------------------ */
/* Price comparisons                                                   */
/* ------------------------------------------------------------------ */

const COMPETITORS: RetailerId[] = [
  "best-buy",
  "ebay",
  "walmart",
  "amazon-warehouse",
];

/**
 * Two competing offers per product, priced above the listing so the seeded
 * listing is genuinely the best price — that's what the comparison view is
 * meant to demonstrate.
 */
export function comparisonsFor(p: SeedProduct) {
  return COMPETITORS.filter((r) => r !== p.retailer)
    .slice(0, 2)
    .map((retailer, i) => ({
      retailer,
      condition:
        i === 0 ? p.condition : ("certified-refurbished" as CardCondition),
      price: Math.round(p.price * (1.06 + i * 0.07)),
      url: `https://example.com/${retailer}/${encodeURIComponent(p.model)}`,
      inStock: i === 0,
    }));
}

/* ------------------------------------------------------------------ */
/* Revenue analytics                                                   */
/* ------------------------------------------------------------------ */

/**
 * Deterministic pseudo-random generator. Seeded so a re-run produces the
 * same order book instead of new noise each time.
 */
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

/** Orders per product over the trailing window, weighted toward cheaper items. */
export function orderCountFor(price: number, rng: () => number): number {
  const affordability = Math.max(1, 6 - Math.log10(Math.max(price, 1)) * 1.6);
  return Math.max(1, Math.round(affordability * (0.6 + rng())));
}

export const SEED_WINDOW_DAYS = 60;
