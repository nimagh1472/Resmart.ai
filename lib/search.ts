/**
 * Catalog full-text search.
 *
 * Lives in `lib/` so both the client-side search bar and the `/api/products`
 * route score queries identically — a shopper who types "xbox" into the header
 * and a partner who hits `?q=xbox` must not get different inventory.
 *
 * The matcher is deliberately boring: normalize, tokenize, require every term
 * to hit *some* field, then rank by where the terms landed. No fuzzy distance,
 * no stemmer — a catalog this size doesn't need one, and typo-tolerance that
 * silently returns the wrong TV is worse than zero results plus an AI match.
 */

import type { Product } from "@/components/ProductCard";
import {
  CONDITIONS_API,
  RETAILERS,
  type ProductCategory,
} from "@/lib/catalog";
import { CATEGORY_LABELS } from "@/lib/mock-products";

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

/**
 * Lowercase, strip anything that isn't a letter or digit, collapse runs of
 * whitespace. `LG C4 65" OLED` and `lg c4 65 oled` normalize to the same thing,
 * and `open-box` becomes the two tokens a shopper typing `open box` produces.
 */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Words that carry no signal about *which* product is wanted. Dropping them
 * matters because matching is AND-based: without this, "cheap xbox deal" would
 * require the words "cheap" and "deal" to appear in a listing and return
 * nothing. "refurbished", "open", "box" and "new" are deliberately absent —
 * those are condition grades and should narrow the results.
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "for",
  "with",
  "under",
  "best",
  "good",
  "cheap",
  "cheapest",
  "deal",
  "deals",
  "sale",
  "price",
  "prices",
  "buy",
  "shop",
  "find",
  "me",
  "my",
  "some",
  "any",
  "please",
  "looking",
  "want",
  "need",
]);

/** Query → distinct, meaningful search terms. */
export function tokenize(query: string): string[] {
  const all = normalize(query).split(" ").filter(Boolean);
  const meaningful = all.filter((t) => !STOPWORDS.has(t));

  // If the shopper typed nothing but stopwords ("best deals"), fall back to the
  // raw tokens rather than treating the query as empty and matching everything.
  const chosen = meaningful.length > 0 ? meaningful : all;
  return Array.from(new Set(chosen));
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/** A searchable slice of a product, with how much a hit there is worth. */
type Field = { label: string; text: string; weight: number };

const buildFields = (p: Product): Field[] => [
  { label: "Title", text: `${p.brand} ${p.model}`, weight: 10 },
  { label: "Brand", text: p.brand, weight: 6 },
  { label: "Keyword", text: (p.keywords ?? []).join(" "), weight: 5 },
  {
    label: "Category",
    text: `${CATEGORY_LABELS[p.category]} ${p.category}`,
    weight: 4,
  },
  { label: "Condition", text: CONDITIONS_API[p.condition].label, weight: 4 },
  { label: "Description", text: p.description ?? "", weight: 2 },
  { label: "Retailer", text: RETAILERS[p.retailer].label, weight: 2 },
  {
    label: "Spec",
    text: (p.specs ?? []).map((s) => `${s.label} ${s.value}`).join(" "),
    weight: 1,
  },
];

/**
 * Prefix-of-word match: "washi" hits "washing machine", "tv" hits "tvs", but
 * "box" does not hit "xbox". Substring-anywhere would make short terms match
 * far too much — "ps" would pull in every listing containing "chips".
 */
function fieldMatches(normalizedField: string, term: string): boolean {
  if (!normalizedField) return false;
  return ` ${normalizedField} `.includes(` ${term}`);
}

export type SearchHit = {
  product: Product;
  score: number;
  /** Which parts of the listing the query landed in, best-weighted first. */
  matchedFields: string[];
};

/** How well one product answers a bag of terms, ignoring AND/OR policy. */
type TermScore = {
  score: number;
  /** How many of the terms landed anywhere in the listing. */
  hits: number;
  matchedFields: string[];
};

function scoreProduct(product: Product, terms: string[]): TermScore {
  const fields = buildFields(product).map((f) => ({
    ...f,
    text: normalize(f.text),
  }));

  let score = 0;
  let hits = 0;
  const matched = new Map<string, number>();

  for (const term of terms) {
    let bestWeight = 0;
    let bestLabel = "";

    for (const field of fields) {
      if (!fieldMatches(field.text, term)) continue;
      // An exact whole-word hit outranks a prefix hit in the same field.
      const exact = ` ${field.text} `.includes(` ${term} `);
      const weight = exact ? field.weight : field.weight * 0.6;
      if (weight > bestWeight) {
        bestWeight = weight;
        bestLabel = field.label;
      }
    }

    if (bestWeight === 0) continue;

    hits += 1;
    score += bestWeight;
    matched.set(bestLabel, (matched.get(bestLabel) ?? 0) + bestWeight);
  }

  return {
    score,
    hits,
    matchedFields: Array.from(matched.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => label),
  };
}

/**
 * Rank `products` against `query`.
 *
 * Every term must match somewhere (AND) — "sony tv" returns Sony televisions,
 * not the union of all Sony gear and all TVs. An empty or all-whitespace query
 * returns an empty array rather than the whole catalog; callers decide what to
 * show when nothing has been typed yet.
 */
export function searchProducts(
  query: string,
  products: Product[],
): SearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const hits: SearchHit[] = [];

  for (const product of products) {
    const { score, hits: matchedTerms, matchedFields } = scoreProduct(
      product,
      terms,
    );

    // AND: every term has to land somewhere.
    if (matchedTerms < terms.length) continue;

    // Nudge a listing whose full title is the query ("xbox series x") above one
    // that merely mentions the same words across scattered fields.
    const titleLead = normalize(`${product.brand} ${product.model}`).startsWith(
      normalize(query),
    )
      ? 8
      : 0;

    hits.push({ product, score: score + titleLead, matchedFields });
  }

  return hits.sort(
    (a, b) =>
      b.score - a.score ||
      b.product.msrp - b.product.price - (a.product.msrp - a.product.price) ||
      (a.product.id < b.product.id ? -1 : 1),
  );
}

/**
 * Rank against a *bag* of candidate terms rather than one typed query.
 *
 * `searchProducts` is AND-based, which is right for a shopper's query but
 * wrong for vision-extracted keywords: requiring a listing to match "samsung"
 * *and* "75" *and* "qled" *and* "smart" finds nothing, while plain OR lets a
 * single high-weight term carry an unrelated product (a lone "samsung" hit on
 * a dryer beating a real TV match).
 *
 * So: pool every term, score by coverage × field weight, and require a listing
 * to cover a meaningful share of the terms before it's a match at all.
 */
export function searchAny(
  queries: string[],
  products: Product[],
  limit = 3,
): SearchHit[] {
  const terms = Array.from(
    new Set(queries.filter(Boolean).flatMap((q) => tokenize(q))),
  );
  if (terms.length === 0) return [];

  // One term means one term must match. Beyond that, roughly a third of the
  // bag — extracted keyword sets always carry terms no listing will have.
  const required = terms.length === 1 ? 1 : Math.max(2, Math.ceil(terms.length * 0.34));

  return products
    .map((product) => {
      const { score, hits, matchedFields } = scoreProduct(product, terms);
      return {
        product,
        // Coverage dominates raw field weight: matching five of nine terms in
        // middling fields beats matching one term in the brand.
        score: score * (hits / terms.length),
        matchedFields,
        hits,
      };
    })
    .filter((hit) => hit.hits >= required)
    .sort((a, b) => b.score - a.score || (a.product.id < b.product.id ? -1 : 1))
    .slice(0, limit)
    .map(({ product, score, matchedFields }) => ({ product, score, matchedFields }));
}

/**
 * The category the query itself is asking about, independent of whether any
 * listing matched — "washing machine" resolves to `appliances` even when the
 * catalog has none in stock. Drives the AI match card's framing.
 */
export function categoryFromQuery(query: string): ProductCategory | null {
  const terms = tokenize(query);
  if (terms.length === 0) return null;

  const CATEGORY_TERMS: Record<ProductCategory, string[]> = {
    tvs: ["tv", "tvs", "television", "oled", "qled", "screen", "bravia"],
    appliances: [
      "washer",
      "washing",
      "dryer",
      "laundry",
      "dishwasher",
      "fridge",
      "refrigerator",
      "freezer",
      "oven",
      "microwave",
      "appliance",
      "appliances",
    ],
    consoles: [
      "xbox",
      "playstation",
      "ps5",
      "ps4",
      "switch",
      "console",
      "nintendo",
      "steamdeck",
    ],
    laptops: [
      "laptop",
      "macbook",
      "notebook",
      "thinkpad",
      "chromebook",
      "ultrabook",
      "xps",
    ],
    headphones: [
      "headphones",
      "headphone",
      "earbuds",
      "airpods",
      "headset",
      "buds",
    ],
    cameras: ["camera", "cameras", "mirrorless", "dslr", "gopro", "lens"],
  };

  for (const [category, keys] of Object.entries(CATEGORY_TERMS) as [
    ProductCategory,
    string[],
  ][]) {
    if (terms.some((t) => keys.includes(t))) return category;
  }
  return null;
}
