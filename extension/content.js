// Runs on Amazon, eBay, and Facebook Marketplace product pages. Pulls the
// listing title, asks ReSmart's combined search for a cheaper alternative,
// and stashes the result for the popup to render.

// TODO: point at the deployed ReSmart origin before shipping.
const API_BASE_URL = "http://localhost:3000";

/** Per-site title selectors, falling back to `document.title` if none match. */
function extractTitle() {
  const host = location.hostname;
  let el = null;

  if (host.includes("amazon.")) {
    el = document.querySelector("#productTitle");
  } else if (host.includes("ebay.")) {
    el = document.querySelector("h1.x-item-title__mainTitle span, #itemTitle");
  } else if (host.includes("facebook.")) {
    el = document.querySelector('[data-testid="marketplace_pdp_title"], h1');
  }

  return (el?.textContent ?? document.title).trim();
}

async function checkForDeals() {
  const title = extractTitle();
  if (!title) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(title)}`);
    if (!res.ok) return;
    const result = await res.json();

    chrome.storage.local.set({
      resmartLastQuery: { title, url: location.href, checkedAt: Date.now(), result },
    });
  } catch (err) {
    console.warn("[ReSmart] search lookup failed", err);
  }
}

checkForDeals();
