/**
 * Live listing feed aggregated across eBay, Amazon, Best Buy, Walmart, and
 * Target via Serper's Shopping API (a single combined search per query,
 * bucketed by retailer below) rather than five separate per-store APIs.
 * Shared by the `/api/products/search` route and the homepage server
 * component so both hit the same normalization logic.
 */

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

export type Store = "eBay" | "Amazon" | "Best Buy" | "Walmart" | "Target";

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
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("SERPER_API_KEY is not configured.");
  return apiKey;
}

/** Every shopping search is cached for an hour so a repeated query is sub-second and stays within Serper's request quota. */
const CACHE_REVALIDATE_SECONDS = 3600;
const CACHE_MS = CACHE_REVALIDATE_SECONDS * 1000;

const shoppingCache = new Map<string, { items: Product[]; expiresAt: number }>();

/** Parses "$1,299.00"-style strings (or already-numeric values) into a number. */
function parsePrice(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return 0;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  return Number(cleaned) || 0;
}

// ---------------------------------------------------------------------------
// Serper Shopping — google.serper.dev/shopping
//
// One combined search returns listings across many merchants at once, so
// instead of five separate per-store APIs, `normalizeStore` maps each
// result's free-text `source` field (e.g. "Amazon.com", "Best Buy") onto one
// of the five retailers ReSmart tracks; anything else (Newegg, small
// marketplace sellers, etc.) is dropped rather than shown as an unbranded
// store. Serper doesn't reliably expose a struck-through list price on
// shopping results, so `originalPrice` is always null here — no discount
// badge is shown for these listings rather than guessing at a field that
// isn't actually there.
// ---------------------------------------------------------------------------

type RawShoppingItem = {
  title?: string;
  source?: string;
  link?: string;
  price?: string | number;
  imageUrl?: string;
  productId?: string;
  position?: number;
};

function normalizeStore(source: string | undefined): Store | null {
  if (!source) return null;
  if (/ebay/i.test(source)) return "eBay";
  if (/amazon/i.test(source)) return "Amazon";
  if (/best\s*buy/i.test(source)) return "Best Buy";
  if (/walmart/i.test(source)) return "Walmart";
  if (/target/i.test(source)) return "Target";
  return null;
}

async function fetchShoppingResults(query: string): Promise<Product[]> {
  const cached = shoppingCache.get(query);
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  const res = await fetch("https://google.serper.dev/shopping", {
    method: "POST",
    headers: {
      "X-API-KEY": requireApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query }),
  });

  if (!res.ok) {
    throw new Error(`Serper shopping request failed with status ${res.status}`);
  }

  const json = (await res.json()) as { shopping?: RawShoppingItem[] };
  const raw = json.shopping ?? [];

  const items: Product[] = [];
  raw.forEach((item, i) => {
    const store = normalizeStore(item.source);
    if (!store) return;

    const price = parsePrice(item.price);
    items.push({
      id: `${store.toLowerCase().replace(/\s+/g, "")}-${item.productId ?? item.position ?? i}`,
      title: String(item.title ?? "Untitled listing"),
      price,
      originalPrice: null,
      image: item.imageUrl ?? null,
      url: String(item.link ?? "#"),
      store,
      condition: null,
    });
  });

  shoppingCache.set(query, { items, expiresAt: Date.now() + CACHE_MS });
  return items;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export type StoreError = { store: Store; message: string };

/** Hard ceiling per store per query — keeps each feed high-signal. */
const MIN_PER_STORE_RESULTS = 8;
const MAX_PER_STORE_RESULTS = 10;

const ALL_STORES: Store[] = ["eBay", "Amazon", "Best Buy", "Walmart", "Target"];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Runs one combined Serper Shopping search for `query`, then buckets the
 * results by retailer (dropping any that aren't one of the five ReSmart
 * tracks) and caps each store at `perStoreLimit` — so one product doesn't
 * crowd out another store's cards. A failed search fails every store
 * uniformly and lands in `errors`, since there's only one upstream call to fail.
 */
export async function fetchAllStores(
  query: string,
  limit = 24,
): Promise<{ items: Product[]; errors: StoreError[] }> {
  const perStoreLimit = Math.min(
    MAX_PER_STORE_RESULTS,
    Math.max(MIN_PER_STORE_RESULTS, Math.ceil(limit / ALL_STORES.length)),
  );

  try {
    const raw = await fetchShoppingResults(query);

    const byStore = new Map<Store, Product[]>();
    for (const item of raw) {
      const bucket = byStore.get(item.store) ?? [];
      if (bucket.length < perStoreLimit) {
        bucket.push(item);
        byStore.set(item.store, bucket);
      }
    }

    const items = ALL_STORES.flatMap((store) => byStore.get(store) ?? []);
    return { items: shuffle(items).slice(0, limit), errors: [] };
  } catch (error) {
    const message = (error as Error).message;
    return { items: [], errors: ALL_STORES.map((store) => ({ store, message })) };
  }
}

/**
 * Fetches several category queries in parallel (each across all five
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

// ---------------------------------------------------------------------------
// Cross-store product grouping
//
// A raw multi-store search returns dozens of individual listings — several
// per store, and often several genuinely different products for a broad
// term like "laptop". `groupListings` clusters listings that are almost
// certainly the same underlying product (near-identical core title tokens)
// into one unified card, so the UI can show "one product, N retailer deals"
// instead of a flat wall of unrelated-looking listings.
// ---------------------------------------------------------------------------

/** Marketing/packaging noise that shouldn't count toward whether two titles describe the same product. */
const GROUP_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "with", "of", "in", "on", "to", "by", "from",
  "new", "open", "box", "renewed", "refurbished", "refurb", "certified", "pre", "owned",
  "preowned", "used", "like", "brand", "genuine", "original", "official", "authentic",
  "package", "bundle", "kit", "set", "edition", "version", "model", "pack", "unlocked",
]);

/** Lowercased, punctuation-stripped, stopword-free token set used to compare two listing titles. */
function coreTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((token) => token.length > 1 && !GROUP_STOPWORDS.has(token)),
  );
}

/** Ratio of shared tokens to total distinct tokens between two titles — 1 is identical, 0 is disjoint. */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of Array.from(a)) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

/** Two listings at or above this token overlap are treated as the same underlying product. */
const GROUP_SIMILARITY_THRESHOLD = 0.5;

export type ProductGroup = {
  id: string;
  title: string;
  image: string | null;
  /** One deal per retailer carrying this product — the cheapest listing from each, sorted by price ascending. */
  deals: Product[];
  lowestPrice: number;
  /** Highest list price any retailer shows for this product, if any do — used to surface cross-store savings. */
  highestListPrice: number | null;
};

function slugify(text: string, maxLength = 60): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLength) || "item"
  );
}

/**
 * Clusters raw listings into unified product cards by core-title similarity,
 * then collapses each cluster to one deal per retailer via
 * `bestOfferPerStore`. Greedy single-pass clustering is O(n²), but n is at
 * most a few dozen listings per query, so that's negligible.
 */
export function groupListings(items: Product[]): ProductGroup[] {
  type Cluster = { tokens: Set<string>; title: string; items: Product[] };
  const clusters: Cluster[] = [];

  for (const item of items) {
    const tokens = coreTokens(item.title);
    let best: Cluster | null = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      const score = jaccardSimilarity(tokens, cluster.tokens);
      if (score >= GROUP_SIMILARITY_THRESHOLD && score > bestScore) {
        best = cluster;
        bestScore = score;
      }
    }

    if (best) {
      best.items.push(item);
      // The shortest title is usually the cleanest — least marketing fluff.
      if (item.title.length > 0 && item.title.length < best.title.length) {
        best.title = item.title;
      }
    } else {
      clusters.push({ tokens, title: item.title, items: [item] });
    }
  }

  return clusters
    .map((cluster) => {
      const deals = bestOfferPerStore(cluster.items);
      const listPrices = deals
        .map((deal) => deal.originalPrice)
        .filter((price): price is number => price != null);

      // Raw per-store listing ids carry characters App Router dynamic
      // segments shouldn't see raw — eBay ids look like `v1|206428227136|0`.
      // `encodeURIComponent` alone would percent-encode rather than strip
      // them, so both halves are slugged here to keep the id itself plain
      // ASCII, then joined — the title slug for readability, the id slug
      // (capped shorter, since it's just a uniqueness key) to keep two
      // clusters with near-identical long titles from colliding after
      // truncation.
      return {
        id: `${slugify(cluster.title, 50)}-${slugify(deals[0]?.id ?? "0", 40)}`,
        title: cluster.title,
        image: deals.find((deal) => deal.image)?.image ?? null,
        deals,
        lowestPrice: deals[0]?.price ?? 0,
        highestListPrice: listPrices.length ? Math.max(...listPrices) : null,
      };
    })
    .sort((a, b) => a.lowestPrice - b.lowestPrice);
}

/** Canonical path for a grouped product's comparison page, carrying enough context in the query string to re-run the cross-store search. */
export function groupHref(group: ProductGroup): string {
  const cheapest = group.deals[0];
  const params = new URLSearchParams({
    title: group.title,
    ...(cheapest ? { store: cheapest.store } : {}),
  });
  return `/product/${encodeURIComponent(group.id)}?${params.toString()}`;
}

/**
 * Picks the group a product detail page should render for. Prefers the
 * group that actually contains the clicked listing (`anchorId`); falls back
 * to whichever group's title is the closest token match for the title the
 * listing card linked with, so a direct link still lands on a sensible
 * product even if the id can't be found in a fresh fetch.
 */
export function bestMatchingGroup(
  groups: ProductGroup[],
  { anchorId, title }: { anchorId?: string; title: string },
): ProductGroup | undefined {
  if (groups.length === 0) return undefined;

  if (anchorId) {
    const direct = groups.find((group) => group.deals.some((deal) => deal.id === anchorId));
    if (direct) return direct;
  }

  const targetTokens = coreTokens(title);
  let best = groups[0];
  let bestScore = -1;

  for (const group of groups) {
    const score = jaccardSimilarity(coreTokens(group.title), targetTokens);
    if (score > bestScore) {
      bestScore = score;
      best = group;
    }
  }

  return best;
}
