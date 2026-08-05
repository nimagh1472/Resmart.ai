import { NextResponse } from "next/server";
import {
  DEFAULT_SEARCH_CATEGORIES,
  fetchAllStores,
  fetchDiverseListings,
  groupListings,
} from "@/lib/marketplace";

/**
 * GET /api/products/search
 *
 * Live inventory feed aggregated across eBay, Amazon, Best Buy, Walmart, and
 * Target via Serper's Shopping API. Raw per-store listings are normalized and clustered
 * by core title/model similarity (`groupListings`) into unified product
 * cards — each card's `deals` array holds one offer per retailer carrying
 * that product, with its own price, condition, and purchase URL, so the
 * client can render a single comparison card per product instead of a flat
 * dump of every individual listing.
 *
 * Query params:
 *   q       search term (defaults to a diverse mix of popular open-box
 *           categories — PS5, iPhone, MacBook, OLED TV, Dyson, AirPods Max)
 *   limit   1–50 grouped product cards returned (default 20)
 *
 * Each store is queried strictly in parallel (`Promise.allSettled` inside
 * `fetchAllStores`/`fetchDiverseListings`) with a 3s per-request timeout, so
 * one slow or failing store never blocks the page — its failure is reported
 * in `partialErrors` instead. Responses are cached for an hour so repeated
 * queries resolve in well under a second.
 */
export const revalidate = 3600;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

  // Fetch more raw listings than `limit` so grouping — which collapses
  // several listings into one card — still has enough material to return
  // close to `limit` distinct product cards.
  const rawLimit = Math.min(50, Math.max(limit * 2, 30));

  try {
    const { items, errors } = q
      ? await fetchAllStores(q, rawLimit)
      : await fetchDiverseListings(DEFAULT_SEARCH_CATEGORIES, rawLimit);

    const groups = groupListings(items).slice(0, limit);

    return NextResponse.json(
      {
        source: "serper-shopping",
        query: q || "diverse-mix",
        count: groups.length,
        items: groups,
        ...(errors.length ? { partialErrors: errors } : {}),
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "upstream_error", details: [(error as Error).message] },
      { status: 502 },
    );
  }
}
