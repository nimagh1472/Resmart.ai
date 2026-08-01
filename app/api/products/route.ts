import { NextResponse } from "next/server";
import {
  RETAILERS,
  CONDITIONS_API,
  type ProductCategory,
  type RetailerId,
} from "@/lib/catalog";
import { MOCK_PRODUCTS, CASHBACK_RATE } from "@/lib/mock-products";

/**
 * GET /api/products
 *
 * Mock inventory feed. Swap the `MOCK_PRODUCTS` source for a Supabase query
 * against `public.products` (see schema.sql) — the response shape is the
 * contract the UI depends on, not the storage.
 *
 * Query params:
 *   q          full-text match on brand + model
 *   category   laptops | cameras | headphones | consoles
 *   retailer   best-buy | ebay | walmart | amazon-warehouse
 *   condition  open-box-excellent | certified-refurbished
 *   maxPrice   number
 *   sort       savings | price-asc | price-desc | discount
 *   limit      1–50 (default 20)
 *   history    "1" to include the 90-day price series (omitted by default)
 */

const VALID_CATEGORIES: ProductCategory[] = [
  "laptops",
  "cameras",
  "headphones",
  "consoles",
];
const VALID_RETAILERS = Object.keys(RETAILERS) as RetailerId[];
const VALID_SORTS = ["savings", "price-asc", "price-desc", "discount"] as const;
type Sort = (typeof VALID_SORTS)[number];

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const category = searchParams.get("category");
  const retailer = searchParams.get("retailer");
  const condition = searchParams.get("condition");
  const maxPriceRaw = searchParams.get("maxPrice");
  const sort = (searchParams.get("sort") ?? "savings") as Sort;
  const includeHistory = searchParams.get("history") === "1";

  // Clamp rather than reject — a bad limit shouldn't fail the whole request.
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit")) || 20),
  );

  const errors: string[] = [];
  if (category && !VALID_CATEGORIES.includes(category as ProductCategory)) {
    errors.push(`Unknown category "${category}".`);
  }
  if (retailer && !VALID_RETAILERS.includes(retailer as RetailerId)) {
    errors.push(`Unknown retailer "${retailer}".`);
  }
  if (condition && !(condition in CONDITIONS_API)) {
    errors.push(`Unknown condition "${condition}".`);
  }
  const maxPrice = maxPriceRaw === null ? null : Number(maxPriceRaw);
  if (maxPrice !== null && (Number.isNaN(maxPrice) || maxPrice <= 0)) {
    errors.push(`maxPrice must be a positive number.`);
  }
  if (!VALID_SORTS.includes(sort)) {
    errors.push(`sort must be one of ${VALID_SORTS.join(", ")}.`);
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "invalid_request", details: errors },
      { status: 400 },
    );
  }

  const matched = MOCK_PRODUCTS.filter((p) => {
    if (category && p.category !== category) return false;
    if (retailer && p.retailer !== retailer) return false;
    if (condition && p.condition !== condition) return false;
    if (maxPrice !== null && p.price > maxPrice) return false;
    if (q && !`${p.brand} ${p.model}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const items = matched
    .map((p) => {
      const savings = p.msrp - p.price;
      const history = p.priceHistory;
      return {
        id: p.id,
        brand: p.brand,
        model: p.model,
        title: `${p.brand} ${p.model}`,
        category: p.category,
        condition: p.condition,
        conditionLabel: CONDITIONS_API[p.condition].label,
        warranty: CONDITIONS_API[p.condition].warranty,
        retailer: {
          id: p.retailer,
          name: RETAILERS[p.retailer].label,
        },
        pricing: {
          currency: "USD",
          msrp: p.msrp,
          price: p.price,
          savings,
          savingsPercent: Math.round((savings / p.msrp) * 100),
          cashback: round2(p.price * CASHBACK_RATE),
          cashbackRate: CASHBACK_RATE,
        },
        trend: {
          windowDays: history.length,
          low: Math.min(...history),
          high: Math.max(...history),
          changeOverWindow: history[history.length - 1] - history[0],
          ...(includeHistory ? { series: history } : {}),
        },
        availability: p.inStock ?? "In stock",
        dealUrl: p.dealUrl,
      };
    })
    .sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return a.pricing.price - b.pricing.price;
        case "price-desc":
          return b.pricing.price - a.pricing.price;
        case "discount":
          return b.pricing.savingsPercent - a.pricing.savingsPercent;
        default:
          return b.pricing.savings - a.pricing.savings;
      }
    })
    .slice(0, limit);

  return NextResponse.json(
    {
      source: "mock",
      count: items.length,
      total: matched.length,
      filters: { q, category, retailer, condition, maxPrice, sort, limit },
      items,
    },
    {
      // Mock data is static; let the edge cache absorb repeat traffic.
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    },
  );
}
