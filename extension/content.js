// Runs on Amazon, Target, and Best Buy product pages. Pulls the listing
// title/price, asks ReSmart's `/api/products/search` (lib/marketplace.ts —
// same contract as the web app's search page) for cheaper open-box or
// refurbished matches, and — if one beats the page's price — shows a
// floating overlay. The result is also stashed for the popup to render.

const OVERLAY_ID = "resmart-overlay";

/** Per-site title/price selectors; a site with no title match is not a product page. */
const SITE_SELECTORS = [
  {
    match: (host) => host.includes("amazon."),
    title: "#productTitle",
    price: "#corePrice_feature_div .a-price .a-offscreen, .a-price .a-offscreen",
  },
  {
    match: (host) => host.includes("target."),
    title: '[data-test="product-title"]',
    price: '[data-test="product-price"]',
  },
  {
    match: (host) => host.includes("bestbuy."),
    title: 'h1[data-testid="heading-title"], h1.heading-5',
    price: '[data-testid="large-customer-price"] span, .priceView-hero-price span',
  },
];

function currentSite() {
  const host = location.hostname;
  return SITE_SELECTORS.find((site) => site.match(host)) ?? null;
}

function parsePrice(text) {
  const cleaned = (text ?? "").replace(/[^0-9.]/g, "");
  return cleaned ? Number(cleaned) : null;
}

function extractProduct(site) {
  const title = (document.querySelector(site.title)?.textContent ?? "").trim();
  const price = parsePrice(document.querySelector(site.price)?.textContent);
  return title ? { title, price } : null;
}

function removeOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function showOverlay(price, dealUrl) {
  removeOverlay();

  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  el.innerHTML = `<span>Open Box available starting at <strong>$${price.toFixed(2)}</strong> via ReSmart</span><a target="_blank" rel="noopener">View deal</a>`;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    maxWidth: "320px",
    background: "#0f172a",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: "13px",
  });

  const link = el.querySelector("a");
  link.href = dealUrl;
  Object.assign(link.style, {
    color: "#34d399",
    fontWeight: "600",
    textDecoration: "none",
    whiteSpace: "nowrap",
  });

  document.body.appendChild(el);
}

async function checkForDeals() {
  const site = currentSite();
  if (!site) return;

  const product = extractProduct(site);
  if (!product) return;

  const { [RESMART_CONFIG.ZIP_STORAGE_KEY]: zip } = await chrome.storage.local.get(
    RESMART_CONFIG.ZIP_STORAGE_KEY,
  );

  const params = new URLSearchParams({ q: product.title, limit: "5" });
  if (zip) params.set("zip", zip);

  try {
    const res = await fetch(`${RESMART_CONFIG.API_BASE_URL}/api/products/search?${params}`);
    if (!res.ok) return;
    const { items } = await res.json();

    // `/api/products/search` only ever returns pre-owned grades (Open Box,
    // Refurbished, Like New, Pre-Owned) — never brand-new — so any deal
    // cheaper than the page's price is a genuine open-box-style savings.
    const deals = (items ?? []).flatMap((group) => group.deals);
    const cheaper = deals
      .filter((deal) => !product.price || deal.price < product.price)
      .sort((a, b) => a.price - b.price);
    const cheapestDeal = cheaper[0] ?? null;

    chrome.storage.local.set({
      [RESMART_CONFIG.LAST_QUERY_STORAGE_KEY]: {
        title: product.title,
        pagePrice: product.price,
        url: location.href,
        checkedAt: Date.now(),
        cheapestDeal,
      },
    });

    if (cheapestDeal) {
      showOverlay(cheapestDeal.price, cheapestDeal.url);
    }
  } catch (err) {
    console.warn("[ReSmart] search lookup failed", err);
  }
}

checkForDeals();
