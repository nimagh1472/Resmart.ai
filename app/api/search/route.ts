import { NextResponse } from "next/server";

/**
 * GET /api/search
 *
 * Thin wrapper around the Google Custom Search JSON API. Google's free tier
 * caps at 100 queries/day, so results are cached in-memory for 24h and a
 * daily counter stops outbound calls at 95 to leave headroom before the hard
 * cap. Cache and counter are per-process (module scope) and reset on deploy.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_QUOTA = 95;

type SearchResult = {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  image: string | null;
};

type CacheEntry = {
  data: SearchResult[];
  expiresAt: number;
};

type GoogleSearchResponse = {
  items?: {
    title?: string;
    link?: string;
    snippet?: string;
    displayLink?: string;
    pagemap?: {
      cse_image?: { src?: string }[];
      cse_thumbnail?: { src?: string }[];
    };
  }[];
};

const cache = new Map<string, CacheEntry>();

let dailyCount = 0;
let dailyResetAt = Date.now() + DAY_MS;

function getRemainingQuota() {
  if (Date.now() > dailyResetAt) {
    dailyCount = 0;
    dailyResetAt = Date.now() + DAY_MS;
  }
  return DAILY_QUOTA - dailyCount;
}

/** Shape written by `app/api/merchant/products/route.ts`'s in-memory store. */
type MerchantProduct = {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  fulfillment_type: "online" | "instore" | "both";
  external_url: string | null;
  store_address: string | null;
};

const globalStore = globalThis as typeof globalThis & {
  __resmartMerchantProducts?: MerchantProduct[];
};

/** ReSmart merchants matching the query, normalized to `SearchResult`'s shape. */
function getMerchantResults(q: string): (SearchResult & {
  source: "resmart";
  price: number;
  fulfillmentType: MerchantProduct["fulfillment_type"];
  storeAddress: string | null;
})[] {
  const needle = q.toLowerCase();
  const products = globalStore.__resmartMerchantProducts ?? [];

  return products
    .filter((p) => p.title.toLowerCase().includes(needle))
    .map((p) => ({
      title: p.title,
      link: p.external_url ?? "",
      snippet:
        p.fulfillment_type === "instore"
          ? `In-store pickup · ${p.store_address ?? ""}`
          : p.fulfillment_type === "both"
            ? `Online or in-store · ${p.store_address ?? ""}`
            : "Available online",
      displayLink: "ReSmart Merchant",
      image: p.image_url,
      source: "resmart" as const,
      price: p.price,
      fulfillmentType: p.fulfillment_type,
      storeAddress: p.store_address,
    }));
}

async function getWebResults(q: string) {
  const cached = cache.get(q);
  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.data, error: null as string | null, status: 200 };
  }

  const remainingDailyQuota = getRemainingQuota();
  if (remainingDailyQuota <= 0) {
    return { data: [] as SearchResult[], error: "daily_quota_exceeded", status: 429 };
  }

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !engineId) {
    return { data: [] as SearchResult[], error: "search_not_configured", status: 503 };
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", engineId);
  url.searchParams.set("q", q);

  try {
    dailyCount += 1;
    const res = await fetch(url.toString());
    if (!res.ok) {
      return { data: [] as SearchResult[], error: "upstream_error", status: 502 };
    }

    const json = (await res.json()) as GoogleSearchResponse;
    const data: SearchResult[] = (json.items ?? []).map((item) => ({
      title: item.title ?? "",
      link: item.link ?? "",
      snippet: item.snippet ?? "",
      displayLink: item.displayLink ?? "",
      image: item.pagemap?.cse_image?.[0]?.src ?? item.pagemap?.cse_thumbnail?.[0]?.src ?? null,
    }));

    cache.set(q, { data, expiresAt: Date.now() + DAY_MS });
    return { data, error: null as string | null, status: 200 };
  } catch {
    return { data: [] as SearchResult[], error: "fetch_failed", status: 502 };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";

  if (!q) {
    return NextResponse.json({ error: "missing_query" }, { status: 400 });
  }

  // Internal listings are always fresh and never rate-limited, so they're
  // fetched independently of Google's cache/quota/availability — a merchant
  // match still surfaces even when the web search leg fails.
  const internalResults = getMerchantResults(q);
  const web = await getWebResults(q);

  return NextResponse.json(
    {
      source: "combined",
      remainingDailyQuota: getRemainingQuota(),
      ...(web.error ? { webError: web.error } : {}),
      internalResults,
      webResults: web.data,
      // Internal ReSmart merchants take priority over the open web.
      data: [...internalResults, ...web.data],
    },
    { status: web.error && internalResults.length === 0 ? web.status : 200 },
  );
}
