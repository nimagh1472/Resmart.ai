import { NextResponse } from "next/server";

/**
 * GET /api/search
 *
 * Scrapes DuckDuckGo's HTML search endpoint (html.duckduckgo.com/html) since
 * it requires no API key and has no request quota, unlike Google Custom
 * Search. Results are cached in-memory for 24h per query to avoid hammering
 * DuckDuckGo (which rate-limits/blocks scraping IPs that request too
 * frequently). Cache is per-process (module scope) and resets on deploy.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x27;/g, "'");
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, "")).trim();
}

/** DuckDuckGo's HTML endpoint routes result links through a `/l/?uddg=` redirect. */
function extractRedirectedUrl(href: string): string {
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : href;
  } catch {
    return href;
  }
}

function parseDuckDuckGoHtml(html: string): SearchResult[] {
  const titleRe = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  // `result__a` and `result__snippet` anchors appear once per result block in
  // the same order (ads included), so they're paired up positionally before
  // ads get filtered out below.
  const titleMatches = Array.from(html.matchAll(titleRe));
  const snippets = Array.from(html.matchAll(snippetRe)).map((m) => stripTags(m[1]));

  const results: SearchResult[] = [];
  titleMatches.forEach((m, i) => {
    const link = extractRedirectedUrl(m[1]);
    const title = stripTags(m[2]);
    if (!link || !title) return;

    let hostname = "";
    try {
      hostname = new URL(link).hostname;
    } catch {
      return;
    }
    // Sponsored links (Bing ads served via duckduckgo.com/y.js) never resolve
    // through the `uddg` redirect param, so they're left pointing back at
    // duckduckgo.com — drop them to keep only organic results.
    if (hostname === "duckduckgo.com") return;

    results.push({
      title,
      link,
      snippet: snippets[i] ?? "",
      displayLink: hostname.replace(/^www\./, ""),
      image: null,
    });
  });

  return results;
}

async function getWebResults(q: string) {
  const cached = cache.get(q);
  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.data, error: null as string | null };
  }

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) {
      console.error("DuckDuckGo search error:", res.status);
      return { data: [] as SearchResult[], error: "upstream_error" };
    }

    const html = await res.text();
    const data = parseDuckDuckGoHtml(html);

    cache.set(q, { data, expiresAt: Date.now() + DAY_MS });
    return { data, error: null as string | null };
  } catch (err) {
    console.error("DuckDuckGo search fetch failed:", err);
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
  // surfaces even when DuckDuckGo fails or is blocked.
  const internalResults = getMerchantResults(q);
  const web = await getWebResults(q);

  // DuckDuckGo failures (blocked, network error, malformed HTML) never fail
  // the request — they degrade to an empty webResults array so internal
  // results still return 200.
  return NextResponse.json({
    source: "web_search",
    ...(web.error ? { webError: web.error } : {}),
    webResults: web.data,
    internalResults,
    // Internal ReSmart merchants take priority over the open web.
    data: [...internalResults, ...web.data],
  });
}
