/**
 * Live listing feed aggregated across eBay, Amazon, Best Buy, and Walmart via
 * RapidAPI. Shared by the `/api/products/search` route and the homepage
 * server component so both hit the same normalization logic.
 *
 * Best Buy and Walmart field mappings are best-effort: their RapidAPI docs
 * are gated behind login, so `pick()` tries several common key-name variants
 * per field. If a store's cards render blank/zero, inspect a live response
 * and add the real key to that store's candidate list below.
 */

const RAPIDAPI_HOSTS = {
  ebay: "real-time-ebay-data.p.rapidapi.com",
  amazon: "real-time-amazon-data.p.rapidapi.com",
  bestBuy: "best-buy-api.p.rapidapi.com",
  walmart: "walmart-data.p.rapidapi.com",
} as const;

/**
 * Curated mix of high-interest categories spanning gaming, phones, laptops,
 * TVs, and audio — used whenever no specific search term is given so the
 * storefront reads as a broad marketplace rather than one niche.
 */
export const DEFAULT_SEARCH_CATEGORIES = [
  "PlayStation 5",
  "iPhone",
  "MacBook",
  "OLED TV",
  "Dyson",
  "AirPods Max",
];

export type Store = "eBay" | "Amazon" | "Best Buy" | "Walmart";

export type Product = {
  id: string;
  title: string;
  price: number;
  originalPrice: number | null;
  image: string | null;
  url: string;
  store: Store;
  condition: string | null;
};

function requireApiKey(): string {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error("RAPIDAPI_KEY is not configured.");
  return apiKey;
}

/** A slow store must never hold up the whole search — abort and let the others win. */
const REQUEST_TIMEOUT_MS = 3000;

/** Every store fetch is cached for an hour so a repeated query is sub-second. */
const CACHE_REVALIDATE_SECONDS = 3600;

async function rapidApiGet(host: string, path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`https://${host}${path}`, {
      headers: {
        "x-rapidapi-key": requireApiKey(),
        "x-rapidapi-host": host,
      },
      signal: controller.signal,
      next: { revalidate: CACHE_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      throw new Error(`${host} request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(`${host} request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Parses "$1,299.00"-style strings (or already-numeric values) into a number. */
function parsePrice(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return 0;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  return Number(cleaned) || 0;
}

/** Returns the first defined value among the candidate keys on `obj`. */
function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

/** An original price only counts if it's a real discount over the current price. */
function normalizeOriginalPrice(price: number, original: number | null): number | null {
  return original !== null && original > price ? original : null;
}

// ---------------------------------------------------------------------------
// eBay — Real-Time eBay Data
// ---------------------------------------------------------------------------

type RawEbayListing = {
  itemId?: string;
  title?: string;
  price?: { value?: string | number };
  marketingPrice?: { originalPrice?: { value?: string | number } };
  image?: { imageUrl?: string };
  itemWebUrl?: string;
  condition?: string;
};

export async function fetchEbayListings(query: string, limit = 20): Promise<Product[]> {
  const json = (await rapidApiGet(
    RAPIDAPI_HOSTS.ebay,
    `/ebay_search?q=${encodeURIComponent(query)}`,
  )) as { itemSummaries?: unknown[] };

  const raw = json.itemSummaries ?? [];

  return raw.slice(0, limit).map((entry, i) => {
    const item = entry as RawEbayListing;
    const price = Number(item.price?.value) || 0;
    const originalPrice = item.marketingPrice?.originalPrice?.value
      ? Number(item.marketingPrice.originalPrice.value)
      : null;

    return {
      id: `ebay-${item.itemId ?? i}`,
      title: String(item.title ?? "Untitled listing"),
      price,
      originalPrice: normalizeOriginalPrice(price, originalPrice),
      image: item.image?.imageUrl ?? null,
      url: String(item.itemWebUrl ?? "#"),
      store: "eBay",
      condition: item.condition ?? "Not specified",
    };
  });
}

// ---------------------------------------------------------------------------
// Amazon — Real-Time Amazon Data
// ---------------------------------------------------------------------------

type RawAmazonListing = {
  asin?: string;
  product_title?: string;
  product_price?: string | number;
  product_original_price?: string | number | null;
  product_photo?: string;
  product_url?: string;
};

export async function fetchAmazonListings(query: string, limit = 20): Promise<Product[]> {
  const json = (await rapidApiGet(
    RAPIDAPI_HOSTS.amazon,
    `/search?query=${encodeURIComponent(query)}&country=US&page=1`,
  )) as { data?: { products?: unknown[] } };

  const raw = json.data?.products ?? [];

  return raw.slice(0, limit).map((entry, i) => {
    const item = entry as RawAmazonListing;
    const price = parsePrice(item.product_price);
    const originalPrice = item.product_original_price ? parsePrice(item.product_original_price) : null;

    return {
      id: `amazon-${item.asin ?? i}`,
      title: String(item.product_title ?? "Untitled listing"),
      price,
      originalPrice: normalizeOriginalPrice(price, originalPrice),
      image: item.product_photo ?? null,
      url: String(item.product_url ?? "#"),
      store: "Amazon",
      condition: null,
    };
  });
}

// ---------------------------------------------------------------------------
// Best Buy — Best Buy Api
//
// This RapidAPI listing is a Crawlbase-backed live scrape of bestbuy.com
// rather than an official product API. The search term param is `st`. On
// failure it returns HTTP 200 with a body shaped like
// { original_status, cb_status, body } instead of a normal error status —
// bestbuy.com's anti-bot layer returns 429/613 to the crawler fairly often,
// which is outside this app's control. That's detected below and surfaced
// as a normal thrown error so it lands in `partialErrors` like any other
// failed store instead of silently returning zero results.
// ---------------------------------------------------------------------------

export async function fetchBestBuyListings(query: string, limit = 20): Promise<Product[]> {
  const json = (await rapidApiGet(
    RAPIDAPI_HOSTS.bestBuy,
    `/search?st=${encodeURIComponent(query)}`,
  )) as Record<string, unknown>;

  if (typeof json.cb_status === "number" && json.cb_status !== 200) {
    throw new Error(`Best Buy crawl failed with upstream status ${json.cb_status}`);
  }

  const raw = (pick(json, ["products", "results", "data"]) as unknown[]) ?? [];

  return raw.slice(0, limit).map((entry, i) => {
    const item = entry as Record<string, unknown>;
    const price = parsePrice(pick(item, ["salePrice", "price", "currentPrice"]));
    const originalRaw = pick(item, ["regularPrice", "listPrice", "originalPrice", "wasPrice"]);
    const originalPrice = originalRaw != null ? parsePrice(originalRaw) : null;
    const id = pick(item, ["sku", "id", "productId"]);

    return {
      id: `bestbuy-${id ?? i}`,
      title: String(pick(item, ["name", "title", "productName"]) ?? "Untitled listing"),
      price,
      originalPrice: normalizeOriginalPrice(price, originalPrice),
      image: (pick(item, ["image", "thumbnailImage", "imageUrl", "largeImage"]) as string) ?? null,
      url: String(pick(item, ["url", "productUrl", "link", "dotComUrl"]) ?? "#"),
      store: "Best Buy",
      condition: null,
    };
  });
}

// ---------------------------------------------------------------------------
// Walmart — Walmart Data
//
// The search term param is `q` (not `query`). Results come back as
// `searchResult`, an array of pages each holding an array of items, so it's
// flattened before mapping. Price/original-price live under `priceInfo`
// (`linePrice` / `wasPrice`) as formatted strings; there's no bare item id,
// so one is extracted from the trailing numeric segment of `productLink`.
// ---------------------------------------------------------------------------

function extractWalmartId(productLink: unknown, fallback: number): string {
  if (typeof productLink === "string") {
    const match = productLink.match(/\/(\d+)(?:[/?]|$)/);
    if (match) return match[1];
  }
  return String(fallback);
}

export async function fetchWalmartListings(query: string, limit = 20): Promise<Product[]> {
  const json = (await rapidApiGet(
    RAPIDAPI_HOSTS.walmart,
    `/search?q=${encodeURIComponent(query)}&page=1`,
  )) as Record<string, unknown>;

  const pages = (json.searchResult as unknown[][]) ?? [];
  const raw = pages.flat();

  return raw.slice(0, limit).map((entry, i) => {
    const item = entry as Record<string, unknown>;
    const priceInfo = item.priceInfo as Record<string, unknown> | undefined;
    const price = parsePrice(pick(item, ["price"]) ?? priceInfo?.linePrice);
    const originalRaw = priceInfo?.wasPrice;
    const originalPrice = originalRaw != null ? parsePrice(originalRaw) : null;

    return {
      id: `walmart-${extractWalmartId(item.productLink, i)}`,
      title: String(pick(item, ["name", "title"]) ?? "Untitled listing"),
      price,
      originalPrice: normalizeOriginalPrice(price, originalPrice),
      image: (pick(item, ["image", "thumbnailUrl", "imageUrl"]) as string) ?? null,
      url: String(pick(item, ["productLink", "link", "url"]) ?? "#"),
      store: "Walmart",
      condition: null,
    };
  });
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export type StoreError = { store: Store; message: string };

/** Hard ceiling per store per query — keeps each API call fast and each feed high-signal. */
const MIN_PER_STORE_RESULTS = 8;
const MAX_PER_STORE_RESULTS = 10;

const ALL_STORES: Store[] = ["eBay", "Amazon", "Best Buy", "Walmart"];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Queries eBay, Amazon, Best Buy, and Walmart strictly in parallel for `query`
 * via `Promise.allSettled`, so one slow or failing store (each capped at
 * `REQUEST_TIMEOUT_MS`) never delays or breaks the others — a rejected store
 * lands in `errors` instead of throwing, and the rest of `items` still loads.
 */
export async function fetchAllStores(
  query: string,
  limit = 24,
): Promise<{ items: Product[]; errors: StoreError[] }> {
  const perStoreLimit = Math.min(
    MAX_PER_STORE_RESULTS,
    Math.max(MIN_PER_STORE_RESULTS, Math.ceil(limit / 4)),
  );

  const settled = await Promise.allSettled([
    fetchEbayListings(query, perStoreLimit),
    fetchAmazonListings(query, perStoreLimit),
    fetchBestBuyListings(query, perStoreLimit),
    fetchWalmartListings(query, perStoreLimit),
  ]);

  const items: Product[] = [];
  const errors: StoreError[] = [];

  settled.forEach((result, i) => {
    const store = ALL_STORES[i];
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      errors.push({ store, message: (result.reason as Error).message });
    }
  });

  return { items: shuffle(items).slice(0, limit), errors };
}

/**
 * Fetches several category queries in parallel (each across all four
 * stores), dedupes, and shuffles into one diverse feed — used for the
 * homepage when no search term is given.
 */
export async function fetchDiverseListings(
  categories: string[] = DEFAULT_SEARCH_CATEGORIES,
  limit = 24,
): Promise<{ items: Product[]; errors: StoreError[] }> {
  const perCategoryLimit = Math.max(4, Math.ceil(limit / categories.length));

  const results = await Promise.all(
    categories.map((category) => fetchAllStores(category, perCategoryLimit)),
  );

  const seen = new Set<string>();
  const merged: Product[] = [];
  const errors: StoreError[] = [];

  for (const result of results) {
    for (const item of result.items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }
    errors.push(...result.errors);
  }

  return { items: shuffle(merged).slice(0, limit), errors };
}

// ---------------------------------------------------------------------------
// Product detail page helpers
// ---------------------------------------------------------------------------

/** Canonical path for a live listing's comparison page, with enough context in the query string to re-run the cross-store search. */
export function liveProductHref(item: Product): string {
  const params = new URLSearchParams({ title: item.title, store: item.store });
  return `/product/${encodeURIComponent(item.id)}?${params.toString()}`;
}

/**
 * One representative listing per store — the cheapest — sorted by price.
 * A raw multi-store search returns several listings per store; the
 * comparison table reads better as one row per retailer than as a dump of
 * every individual result.
 */
export function bestOfferPerStore(items: Product[]): Product[] {
  const cheapestByStore = new Map<Store, Product>();

  for (const item of items) {
    const current = cheapestByStore.get(item.store);
    if (!current || item.price < current.price) {
      cheapestByStore.set(item.store, item);
    }
  }

  return Array.from(cheapestByStore.values()).sort((a, b) => a.price - b.price);
}
