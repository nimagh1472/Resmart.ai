import { NextResponse } from "next/server";
import {
  DEFAULT_SEARCH_CATEGORIES,
  fetchAllStores,
  fetchDiverseListings,
  groupListings,
  matchesConditionFilter,
  type ConditionFilter,
} from "@/lib/marketplace";

const VALID_CONDITIONS: ConditionFilter[] = ["refurbished", "open-box-pre-owned"];
const VALID_FULFILLMENT = ["direct-shipping", "in-store-pickup"] as const;
type Fulfillment = (typeof VALID_FULFILLMENT)[number];

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
 *   q            search term (defaults to a diverse mix of popular open-box
 *                categories — PS5, iPhone, MacBook, OLED TV, Dyson, AirPods Max)
 *   limit        1–50 grouped product cards returned (default 20)
 *   condition    refurbished | open-box-pre-owned — narrows each group's deals
 *                to that grade; a group left with no matching deals is dropped.
 *                There's no "brand-new" value here — this pipeline never
 *                surfaces brand-new inventory (see lib/marketplace.ts); browse
 *                the curated catalog via /api/products for that.
 *   fulfillment  direct-shipping | in-store-pickup — every listing here is an
 *                external retailer link (ship-to-you), so "in-store-pickup"
 *                always returns zero results with `fulfillmentUnavailable: true`
 *                rather than silently omitting listings.
 *   zip          reserved for local-pickup matching once in-store listings
 *                exist in this feed; currently has no effect.
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

  const conditionRaw = searchParams.get("condition");
  if (conditionRaw && !VALID_CONDITIONS.includes(conditionRaw as ConditionFilter)) {
    return NextResponse.json(
      {
        error: "invalid_request",
        details: [`condition must be one of ${VALID_CONDITIONS.join(", ")}.`],
      },
      { status: 400 },
    );
  }
  const condition = conditionRaw as ConditionFilter | null;

  const fulfillmentRaw = searchParams.get("fulfillment");
  if (fulfillmentRaw && !VALID_FULFILLMENT.includes(fulfillmentRaw as Fulfillment)) {
    return NextResponse.json(
      {
        error: "invalid_request",
        details: [`fulfillment must be one of ${VALID_FULFILLMENT.join(", ")}.`],
      },
      { status: 400 },
    );
  }

  // Every listing here is an external retailer link — none of them are local
  // pickup, so asking for in-store pickup always comes back empty. Said
  // explicitly via `fulfillmentUnavailable` rather than an unexplained
  // zero-result search, which would read as "nothing matched your query."
  if (fulfillmentRaw === "in-store-pickup") {
    return NextResponse.json(
      {
        source: "serper-shopping",
        query: q || "diverse-mix",
        count: 0,
        items: [],
        fulfillmentUnavailable: true,
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  }

  // Fetch more raw listings than `limit` so grouping — which collapses
  // several listings into one card — still has enough material to return
  // close to `limit` distinct product cards.
  const rawLimit = Math.min(50, Math.max(limit * 2, 30));

  try {
    const { items, errors } = q
      ? await fetchAllStores(q, rawLimit)
      : await fetchDiverseListings(DEFAULT_SEARCH_CATEGORIES, rawLimit);

    let groups = groupListings(items);
    if (condition) {
      groups = groups
        .map((group) => ({
          ...group,
          deals: group.deals.filter((deal) => matchesConditionFilter(deal.condition, condition)),
        }))
        .filter((group) => group.deals.length > 0);
    }
    groups = groups.slice(0, limit);

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
