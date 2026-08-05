import { NextResponse } from "next/server";

/**
 * Merchant product intake with fulfillment options.
 *
 * POST /api/merchant/products — merchant submits a product with `online`,
 * `instore`, or `both` fulfillment. Backed by an in-memory store pinned to
 * `globalThis` (same pattern as `lib/merchant-store.ts`) so hot reload
 * doesn't wipe submissions between requests; swapping in Supabase later
 * leaves this contract untouched.
 *
 * GET /api/merchant/products — lists what's been submitted, newest first.
 */

type FulfillmentType = "online" | "instore" | "both";

type MerchantProduct = {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  fulfillment_type: FulfillmentType;
  external_url: string | null;
  store_address: string | null;
  createdAt: string;
};

const globalStore = globalThis as typeof globalThis & {
  __resmartMerchantProducts?: MerchantProduct[];
};
const store =
  globalStore.__resmartMerchantProducts ??
  (globalStore.__resmartMerchantProducts = []);

const FULFILLMENT_TYPES: FulfillmentType[] = ["online", "instore", "both"];
const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Extracts an Open Graph or `<title>` tag's value without a full HTML parser. */
function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match) return match[1];
  }
  return null;
}

/** Best-effort title/image/price scrape from an external product page. */
async function fetchExternalMetadata(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const html = await res.text();

    const title =
      extractMeta(html, "og:title") ??
      html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ??
      null;
    const image = extractMeta(html, "og:image");
    const priceRaw =
      extractMeta(html, "product:price:amount") ??
      extractMeta(html, "og:price:amount");
    const price = priceRaw ? Number(priceRaw) : null;

    return { title, image, price: Number.isFinite(price) ? price : null };
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json(
    { source: "mock", count: store.length, products: store },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "invalid_request", details: ["Body must be JSON."] },
      { status: 400, headers: NO_STORE },
    );
  }

  const externalUrl =
    typeof body.external_url === "string" ? body.external_url.trim() : "";
  let title = typeof body.title === "string" ? body.title.trim() : "";
  let imageUrl =
    typeof body.image_url === "string" ? body.image_url.trim() : "";
  let price = Number(body.price);

  // Only reach out if the merchant left something for us to fill in — a
  // fully specified submission never pays the network round trip.
  if (
    externalUrl &&
    (!title || !imageUrl || !Number.isFinite(price) || price <= 0)
  ) {
    const meta = await fetchExternalMetadata(externalUrl);
    if (meta) {
      title = title || meta.title || "";
      imageUrl = imageUrl || meta.image || "";
      if (!Number.isFinite(price) || price <= 0) {
        price = meta.price ?? price;
      }
    }
  }

  const fulfillmentType = body.fulfillment_type as FulfillmentType;
  const storeAddress =
    typeof body.store_address === "string" ? body.store_address.trim() : "";

  const details: string[] = [];
  if (!title) details.push("title is required.");
  if (!Number.isFinite(price) || price <= 0) {
    details.push("price must be greater than zero.");
  }
  if (!FULFILLMENT_TYPES.includes(fulfillmentType)) {
    details.push(`fulfillment_type must be one of ${FULFILLMENT_TYPES.join(", ")}.`);
  }
  if ((fulfillmentType === "online" || fulfillmentType === "both") && !externalUrl) {
    details.push("external_url is required for online fulfillment.");
  }
  if ((fulfillmentType === "instore" || fulfillmentType === "both") && !storeAddress) {
    details.push("store_address is required for in-store fulfillment.");
  }

  if (details.length > 0) {
    return NextResponse.json(
      { error: "invalid_request", details },
      { status: 400, headers: NO_STORE },
    );
  }

  const product: MerchantProduct = {
    id: `prd-${Math.random().toString(36).slice(2, 8)}`,
    title,
    price,
    image_url: imageUrl || null,
    fulfillment_type: fulfillmentType,
    external_url: externalUrl || null,
    store_address: storeAddress || null,
    createdAt: new Date().toISOString(),
  };
  store.unshift(product);

  return NextResponse.json(
    { source: "mock", persisted: false, product },
    { status: 201, headers: NO_STORE },
  );
}
