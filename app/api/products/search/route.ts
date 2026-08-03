import { NextResponse } from "next/server";
import { fetchEbayListings } from "@/lib/ebay";

/**
 * GET /api/products/search
 *
 * Live inventory feed sourced from RapidAPI's Real-Time eBay Data API.
 *
 * Query params:
 *   q       search term (defaults to "laptop")
 *   limit   1–50 (default 20)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "laptop";
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

  try {
    const items = await fetchEbayListings(q, limit);
    return NextResponse.json(
      { source: "rapidapi-ebay", query: q, count: items.length, items },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "upstream_error", details: [(error as Error).message] },
      { status: 502 },
    );
  }
}
