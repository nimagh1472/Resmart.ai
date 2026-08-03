/**
 * Live listing feed via RapidAPI's Real-Time eBay Data API. Shared by the
 * `/api/products/search` route and the homepage server component so both
 * hit the same normalization logic.
 */

const RAPIDAPI_HOST = "real-time-ebay-data.p.rapidapi.com";

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

  return raw.slice(0, limit).map((entry, i) => {
    const item = entry as Record<string, any>;
    return {
      id: String(item.itemId ?? i),
      title: String(item.title ?? "Untitled listing"),
      price: Number(item.price?.value) || 0,
      image: (item.image?.imageUrl as string) ?? null,
      url: String(item.itemWebUrl ?? "#"),
      condition: String(item.condition ?? "Not specified"),
    };
  });
}
