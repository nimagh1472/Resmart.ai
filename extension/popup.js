const FULFILLMENT_LABEL = {
  online: "Online",
  instore: "In-store",
  both: "Online or in-store",
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function render(entry) {
  const root = document.getElementById("root");

  if (!entry) {
    root.innerHTML =
      '<p class="empty">Visit a product page on Amazon, eBay, or Facebook Marketplace to check for a cheaper alternative.</p>';
    return;
  }

  const { title, result } = entry;
  const internal = result?.internalResults ?? [];
  const web = result?.webResults ?? [];
  // Internal ReSmart merchants are already priority-sorted by the API.
  const cheapest = internal[0];

  let html = `<p class="title">${escapeHtml(title)}</p>`;

  if (cheapest) {
    html += `
      <div class="alert">
        <p class="alert-title">Cheaper alternative found</p>
        <p class="alert-body">${escapeHtml(cheapest.title)} — $${Number(cheapest.price).toFixed(2)}</p>
        <p class="alert-meta">${FULFILLMENT_LABEL[cheapest.fulfillmentType] ?? ""}</p>
        ${cheapest.link ? `<a href="${escapeHtml(cheapest.link)}" target="_blank" rel="noopener">View deal</a>` : ""}
      </div>`;
  } else {
    html += `<p class="empty">No ReSmart merchant match yet — showing ${web.length} web result${web.length === 1 ? "" : "s"}.</p>`;
  }

  root.innerHTML = html;
}

chrome.storage.local.get("resmartLastQuery", ({ resmartLastQuery }) => {
  render(resmartLastQuery);
});
