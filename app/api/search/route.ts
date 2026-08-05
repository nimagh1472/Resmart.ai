import { NextResponse } from "next/server";

/**
 * GET /api/search
 *
 * Fetches web results from the Serper API (google.serper.dev/search), which
 * proxies real Google search results and requires SERPER_API_KEY. Results
 * are cached in-memory for 24h per query to stay within Serper's request
 * quota. Cache is per-process (module scope) and resets on deploy.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

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

const cache = new Map<string, CacheEntry>();

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

type SerperOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
  snippet_highlight?: string[];
};

function parseSerperResults(organic: SerperOrganicResult[]): SearchResult[] {
  const results: SearchResult[] = [];

  for (const item of organic) {
    const title = item.title?.trim();
    const link = item.link?.trim();
    if (!title || !link) continue;

    let hostname = "";
    try {
      hostname = new URL(link).hostname;
    } catch {
      continue;
    }

    results.push({
      title,
      link,
      snippet: item.snippet ?? item.snippet_highlight?.join(" ") ?? "",
      displayLink: hostname.replace(/^www\./, ""),
      image: null,
    });
  }

  return results;
}

async function getWebResults(q: string) {
  const cached = cache.get(q);
  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.data, error: null as string | null };
  }

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.error("Serper search error: SERPER_API_KEY is not set");
    return { data: [] as SearchResult[], error: "missing_api_key" };
  }

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q }),
    });

    if (!res.ok) {
      console.error("Serper search error:", res.status);
      return { data: [] as SearchResult[], error: "upstream_error" };
    }

    const json = await res.json();
    const data = parseSerperResults(json.organic ?? []);

    cache.set(q, { data, expiresAt: Date.now() + DAY_MS });
    return { data, error: null as string | null };
  } catch (err) {
    console.error("Serper search fetch failed:", err);
    return { data: [] as SearchResult[], error: "fetch_failed" };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";

  if (!q) {
    return NextResponse.json({ error: "missing_query" }, { status: 400 });
  }

  // Internal listings are always fresh and never rate-limited, so they're
  // fetched independently of the web search leg — a merchant match still
  // surfaces even when Serper fails or is unavailable.
  const internalResults = getMerchantResults(q);
  const web = await getWebResults(q);

  // Serper failures (missing key, network error, upstream error) never fail
  // the request — they degrade to an empty webResults array so internal
  // results still return 200.
  return NextResponse.json({
    source: "serper_web_search",
    ...(web.error ? { webError: web.error } : {}),
    webResults: web.data,
    internalResults,
    // Internal ReSmart merchants take priority over the open web.
    data: [...internalResults, ...web.data],
  });
}
