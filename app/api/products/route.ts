import { NextResponse } from "next/server";
import {
  RETAILERS,
  CONDITIONS_API,
  type CardCondition,
  type ProductCategory,
  type RetailerId,
} from "@/lib/catalog";
import { MOCK_PRODUCTS, CASHBACK_RATE } from "@/lib/mock-products";
import { searchProducts } from "@/lib/search";
import { CPC_MAX, CPC_MIN, validateImageSource } from "@/lib/mock-merchant";

/**
 * GET /api/products
 *
 * Mock inventory feed. Swap the `MOCK_PRODUCTS` source for a Supabase query
 * against `public.products` (see schema.sql) — the response shape is the
 * contract the UI depends on, not the storage.
 *
 * Query params:
 *   q          full-text match on title, description, category, brand,
 *              condition and specs — see lib/search.ts
 *   category   laptops | cameras | headphones | consoles | tvs | appliances
 *   retailer   best-buy | ebay | walmart | amazon-warehouse
 *   condition  open-box-excellent | certified-refurbished
 *   maxPrice   number
 *   sort       relevance | savings | price-asc | price-desc | discount
 *              (defaults to relevance when `q` is set, savings otherwise)
 *   limit      1–50 (default 20)
 *   history    "1" to include the 90-day price series (omitted by default)
 */

const VALID_CATEGORIES: ProductCategory[] = [
  "laptops",
  "cameras",
  "headphones",
  "consoles",
  "tvs",
  "appliances",
];
const VALID_RETAILERS = Object.keys(RETAILERS) as RetailerId[];
const VALID_SORTS = [
  "relevance",
  "savings",
  "price-asc",
  "price-desc",
  "discount",
] as const;
type Sort = (typeof VALID_SORTS)[number];

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const category = searchParams.get("category");
  const retailer = searchParams.get("retailer");
  const condition = searchParams.get("condition");
  const maxPriceRaw = searchParams.get("maxPrice");
  // Relevance is only meaningful with a query; without one it would be an
  // arbitrary order, so unqueried requests still default to best-savings-first.
  const sort = (searchParams.get("sort") ?? (q ? "relevance" : "savings")) as Sort;
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

  // Facets narrow first, then the text query ranks what's left — so `q` is
  // scored against the same set the caller asked for, not the whole catalog.
  const faceted = MOCK_PRODUCTS.filter((p) => {
    if (category && p.category !== category) return false;
    if (retailer && p.retailer !== retailer) return false;
    if (condition && p.condition !== condition) return false;
    if (maxPrice !== null && p.price > maxPrice) return false;
    return true;
  });

  const matched = q
    ? searchProducts(q, faceted).map((hit) => hit.product)
    : faceted;

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
        // `matched` already carries relevance order; Array.prototype.sort is
        // stable per spec, so returning 0 preserves it.
        case "relevance":
          return 0;
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

/**
 * POST /api/products
 *
 * Merchant inventory intake — the dashboard posts a listing here when a
 * merchant adds or edits a product. `imageUrl` carries either an http(s)
 * hotlink or a base64 data URL from a local upload, and is validated with the
 * same rule the form uses so a client bypass can't store a `javascript:` or
 * `blob:` src. Persisting is an insert into `public.products` (schema.sql —
 * `image_url text`); the mock validates and echoes the row it would have
 * written, so the client can rely on one shape either way.
 *
 * Body: { title, condition, msrp, price, stock, url, imageUrl?, boostEnabled?, cpcBid? }
 */

type ListingBody = {
  title?: unknown;
  description?: unknown;
  condition?: unknown;
  msrp?: unknown;
  price?: unknown;
  stock?: unknown;
  url?: unknown;
  imageUrl?: unknown;
  boostEnabled?: unknown;
  cpcBid?: unknown;
};

const isHttpUrl = (value: string) => {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
};

export async function POST(request: Request) {
  let body: ListingBody;
  try {
    body = (await request.json()) as ListingBody;
  } catch {
    return NextResponse.json(
      { error: "invalid_request", details: ["Body must be JSON."] },
      { status: 400 },
    );
  }

  const errors: string[] = [];

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) errors.push("title is required.");

  // Optional prose — may be AI-drafted, so it's length-capped rather than free.
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > 2000) {
    errors.push("description must be 2000 characters or fewer.");
  }

  const condition = typeof body.condition === "string" ? body.condition : "";
  if (!(condition in CONDITIONS_API)) {
    errors.push(`Unknown condition "${condition}".`);
  }

  const msrp = Number(body.msrp);
  const price = Number(body.price);
  if (!Number.isFinite(msrp) || msrp <= 0) {
    errors.push("msrp must be a positive number.");
  }
  if (!Number.isFinite(price) || price <= 0) {
    errors.push("price must be a positive number.");
  } else if (Number.isFinite(msrp) && price > msrp) {
    errors.push("price must be at or below msrp.");
  }

  const stock = Number(body.stock);
  if (!Number.isInteger(stock) || stock < 0) {
    errors.push("stock must be a whole number of zero or more.");
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!isHttpUrl(url)) errors.push("url must be an http(s) URL.");

  // Optional, but a supplied image has to be something a browser can render.
  let imageUrl: string | null = null;
  if (body.imageUrl !== undefined && body.imageUrl !== null && body.imageUrl !== "") {
    if (typeof body.imageUrl !== "string") {
      errors.push("imageUrl must be a string.");
    } else {
      const check = validateImageSource(body.imageUrl.trim());
      if (check.ok) imageUrl = body.imageUrl.trim();
      else errors.push(check.reason);
    }
  }

  const boostEnabled = body.boostEnabled === true;
  const cpcBid = body.cpcBid === undefined ? CPC_MIN : Number(body.cpcBid);
  if (!Number.isFinite(cpcBid) || cpcBid < CPC_MIN || cpcBid > CPC_MAX) {
    errors.push(`cpcBid must be between ${CPC_MIN} and ${CPC_MAX}.`);
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "invalid_request", details: errors },
      { status: 400 },
    );
  }

  const savings = msrp - price;
  const item = {
    id: `lst-${Date.now().toString(36)}`,
    title,
    description: description || null,
    condition,
    conditionLabel: CONDITIONS_API[condition as CardCondition].label,
    warranty: CONDITIONS_API[condition as CardCondition].warranty,
    imageUrl,
    dealUrl: url,
    stock,
    availability: stock === 0 ? "Out of stock" : `${stock} in stock`,
    pricing: {
      currency: "USD",
      msrp,
      price,
      savings,
      savingsPercent: Math.round((savings / msrp) * 100),
      cashback: round2(price * CASHBACK_RATE),
      cashbackRate: CASHBACK_RATE,
    },
    boost: { enabled: boostEnabled, cpcBid },
  };

  return NextResponse.json(
    { source: "mock", persisted: false, item },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
