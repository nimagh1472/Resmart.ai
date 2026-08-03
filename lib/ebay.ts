/**
 * Live listing feed via RapidAPI's Real-Time eBay Data API. Shared by the
 * `/api/products/search` route and the homepage server component so both
 * hit the same normalization logic.
 */

const RAPIDAPI_HOST = "real-time-ebay-data.p.rapidapi.com";

/**
 * Curated mix of high-interest open-box categories spanning gaming, phones,
 * laptops, TVs, and audio — used whenever no specific search term is given
 * so the storefront reads as a broad marketplace rather than one niche.
 */
export const DEFAULT_SEARCH_CATEGORIES = [
  "PlayStation 5",
  "iPhone",
  "MacBook",
  "OLED TV",
  "Dyson",
  "AirPods Max",
];

export type EbayListing = {
  id: string;
  title: string;
  price: number;
  image: string | null;
  url: string;
  condition: string;
};

export async function fetchEbayListings(
  query: string,
  limit = 20,
): Promise<EbayListing[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error("RAPIDAPI_KEY is not configured.");

  const url = `https://${RAPIDAPI_HOST}/ebay_search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": RAPIDAPI_HOST,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`RapidAPI eBay search failed with status ${response.status}`);
  }

  const json = await response.json();
  const raw: unknown[] = json.itemSummaries ?? [];

  type RawListing = {
    itemId?: string;
    title?: string;
    price?: { value?: string | number };
    image?: { imageUrl?: string };
    itemWebUrl?: string;
    condition?: string;
  };

  return raw.slice(0, limit).map((entry, i) => {
    const item = entry as RawListing;
    return {
      id: String(item.itemId ?? i),
      title: String(item.title ?? "Untitled listing"),
      price: Number(item.price?.value) || 0,
      image: item.image?.imageUrl ?? null,
      url: String(item.itemWebUrl ?? "#"),
      condition: String(item.condition ?? "Not specified"),
    };
  });
}

/**
 * Fetches several category queries in parallel and interleaves the results
 * (round-robin) so the combined feed alternates between categories instead
 * of running one category at a time, then trims to `limit` and dedupes.
 */
export async function fetchDiverseEbayListings(
  categories: string[] = DEFAULT_SEARCH_CATEGORIES,
  limit = 20,
): Promise<EbayListing[]> {
  const perCategoryLimit = Math.max(4, Math.ceil(limit / categories.length));

  const results = await Promise.all(
    categories.map((category) =>
      fetchEbayListings(category, perCategoryLimit).catch(() => []),
    ),
  );

  const interleaved: EbayListing[] = [];
  const seen = new Set<string>();
  const maxRounds = Math.max(...results.map((r) => r.length), 0);

  for (let round = 0; round < maxRounds; round++) {
    for (const categoryResults of results) {
      const item = categoryResults[round];
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        interleaved.push(item);
      }
    }
  }

  return interleaved.slice(0, limit);
}
