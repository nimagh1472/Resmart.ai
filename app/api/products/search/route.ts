import { NextResponse } from "next/server";
import { fetchAllStores, fetchDiverseListings, DEFAULT_SEARCH_CATEGORIES } from "@/lib/marketplace";

/**
 * GET /api/products/search
 *
 * Live inventory feed aggregated across eBay, Amazon, Best Buy, and Walmart
 * via RapidAPI, merged and shuffled into one mixed-store feed.
 *
 * Query params:
 *   q       search term (defaults to a diverse mix of popular open-box
 *           categories — PS5, iPhone, MacBook, OLED TV, Dyson, AirPods Max)
 *   limit   1–50 (default 20)
 *
 * If one store's API fails or rate-limits, results from the others still
 * load — failures are reported in `partialErrors` rather than failing the
 * whole request.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

  try {
    const { items, errors } = q
      ? await fetchAllStores(q, limit)
      : await fetchDiverseListings(DEFAULT_SEARCH_CATEGORIES, limit);

    return NextResponse.json(
      {
        source: "rapidapi-multi",
        query: q || "diverse-mix",
        count: items.length,
        items,
        ...(errors.length ? { partialErrors: errors } : {}),
      },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "upstream_error", details: [(error as Error).message] },
      { status: 502 },
    );
  }
}
