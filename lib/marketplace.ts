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
  /** Always set — "New" listings never survive `detectCondition`'s hard filter, so every returned item is one of the four pre-owned categories. */
  condition: Condition | null;
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
  condition?: string;
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

// ---------------------------------------------------------------------------
// Condition targeting — ReSmart only lists pre-owned deals (open box,
// refurbished, like new, pre-owned), never brand-new inventory. The query
// itself is steered toward those terms, but Serper still mixes in brand-new
// listings, so every result is re-checked against its title (and `condition`
// field, when Serper supplies one) and dropped unless it clearly matches one
// of the four categories below.
// ---------------------------------------------------------------------------

/** Appended to every outbound query so Serper Shopping favors pre-owned inventory. */
const CONDITION_QUERY_SUFFIX = '("open box" OR "refurbished" OR "like new" OR "pre-owned")';

function buildConditionQuery(query: string): string {
  return `${query} ${CONDITION_QUERY_SUFFIX}`;
}

// ---------------------------------------------------------------------------
// Query sanitization — queries are often copy-pasted retailer titles, e.g.
// `Restored Sony 3005718 PlayStation 5 Console (Refurbished), Size: No
// Membership, Black`. Serper Shopping matches poorly (often zero results)
// against labeled attribute noise ("Size: No Membership") and long internal
// SKU/UPC numbers, so both are stripped before every outbound query. If the
// cleaned query still comes back empty, `simplifySearchQuery` trims it down
// to just its first few core tokens (the brand/product name) and the search
// is retried once — `buildConditionQuery`'s OR clause re-applies the
// pre-owned constraint on that retry too, so condition targeting never gets
// lost in the fallback.
// ---------------------------------------------------------------------------

/** Attribute labels retailers commonly tack onto a title as "Label: value" noise. */
const ATTRIBUTE_LABEL_RE =
  /\b(?:size|color|colour|style|capacity|storage|condition|network|carrier|membership|material|pattern|flavor|scent|length|width|height|weight|type)\s*:\s*[^,]*/gi;

/** Long digit runs (SKUs, UPCs, internal model numbers) that don't help — and often hurt — a shopping match. */
const LONG_NUMERIC_ID_RE = /\b\d{5,}\b/g;

/**
 * Strips retailer-noise from a raw (often copy-pasted) query: labeled
 * attribute pairs, long SKU/UPC-style numbers, and parenthesis characters
 * around condition words (the words are kept — the parens themselves confuse
 * the matcher more than the words inside them).
 */
export function sanitizeSearchQuery(rawQuery: string): string {
  return rawQuery
    .replace(ATTRIBUTE_LABEL_RE, " ")
    .replace(LONG_NUMERIC_ID_RE, " ")
    .replace(/[()]/g, " ")
    .replace(/,/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Cap on how many leading tokens survive into the simplified fallback query. */
const SIMPLIFIED_QUERY_MAX_TOKENS = 4;

/**
 * Falls back further than `sanitizeSearchQuery` when even the cleaned query
 * returns nothing: keeps only the first few non-filler tokens (the
 * brand/product core, e.g. "Sony PlayStation 5"), dropping condition and
 * marketing filler words via the same stopword list `groupListings` uses to
 * compare titles.
 */
function simplifySearchQuery(query: string): string {
  const tokens = query
    .split(/\s+/)
    .filter((token) => token.length > 0 && !GROUP_STOPWORDS.has(token.toLowerCase()));
  return tokens.slice(0, SIMPLIFIED_QUERY_MAX_TOKENS).join(" ");
}

/** The only condition labels ReSmart ever shows on a listing card. */
export type Condition = "Open Box" | "Refurbished" | "Like New" | "Pre-Owned";

/**
 * Search-panel condition buckets. Coarser than `Condition` — "Open
 * Box"/"Pre-Owned"/"Like New" are grouped into one filter option since that's
 * how the search control panel presents them. There's no "brand-new" bucket
 * here: this pipeline's `detectCondition` hard-filters brand-new listings out
 * before they ever reach a `Product`, by design (see `CONDITION_QUERY_SUFFIX`
 * above) — the curated catalog (`/api/products`) is the only place brand-new
 * inventory is filterable.
 */
export type ConditionFilter = "refurbished" | "open-box-pre-owned";

export function matchesConditionFilter(
  condition: Condition | null,
  filter: ConditionFilter,
): boolean {
  if (!condition) return false;
  if (filter === "refurbished") return condition === "Refurbished";
  return condition === "Open Box" || condition === "Pre-Owned" || condition === "Like New";
}

/**
 * Classifies a listing's condition from its title and (when present)
 * Serper's own `condition` field. Returns null for anything that doesn't
 * clearly read as pre-owned — including plain "new"/"brand new" listings —
 * so the caller can drop it rather than guess.
 */
function detectCondition(title: string, rawCondition?: string): Condition | null {
  const text = `${rawCondition ?? ""} ${title}`.toLowerCase();
  if (/\bopen box\b/.test(text)) return "Open Box";
  if (/\b(certified refurbished|refurbished|refurb(?:ished)?|renewed)\b/.test(text)) return "Refurbished";
  if (/\blike new\b/.test(text)) return "Like New";
  if (/\b(pre-?owned|used)\b/.test(text)) return "Pre-Owned";
  return null;
}

/** Runs a single Serper Shopping call for an already-cleaned query and normalizes the response. */
async function runShoppingQuery(query: string): Promise<Product[]> {
  const res = await fetch("https://google.serper.dev/shopping", {
    method: "POST",
    headers: {
      "X-API-KEY": requireApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: buildConditionQuery(query) }),
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

    const title = String(item.title ?? "Untitled listing");
    const condition = detectCondition(title, item.condition);
    // Hard filter: no clear pre-owned signal (or an explicit "new") means it's dropped, never shown as "unknown".
    if (!condition) return;

    const price = parsePrice(item.price);
    items.push({
      id: `${store.toLowerCase().replace(/\s+/g, "")}-${item.productId ?? item.position ?? i}`,
      title,
      price,
      originalPrice: null,
      image: item.imageUrl ?? null,
      url: String(item.link ?? "#"),
      store,
      condition,
    });
  });

  return items;
}

async function fetchShoppingResults(rawQuery: string): Promise<Product[]> {
  const cached = shoppingCache.get(rawQuery);
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  const cleaned = sanitizeSearchQuery(rawQuery) || rawQuery;
  let items = await runShoppingQuery(cleaned);

  // The cleaned query can still be too specific to match anything (rare
  // model numbers, uncommon phrasing) — retry once with just its core
  // brand/product tokens rather than surfacing an empty comparison page.
  if (items.length === 0) {
    const simplified = simplifySearchQuery(cleaned);
    if (simplified && simplified.toLowerCase() !== cleaned.toLowerCase()) {
      items = await runShoppingQuery(simplified);
    }
  }

  shoppingCache.set(rawQuery, { items, expiresAt: Date.now() + CACHE_MS });
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
