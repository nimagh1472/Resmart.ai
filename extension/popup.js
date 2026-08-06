function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderDeal(entry) {
  const root = document.getElementById("root");

  if (!entry) {
    root.innerHTML =
      '<p class="empty">Visit a product page on Amazon, Target, or Best Buy to check for a cheaper open-box or refurbished option.</p>';
    return;
  }

  const { title, cheapestDeal } = entry;
  let html = `<p class="title">${escapeHtml(title)}</p>`;

  if (cheapestDeal) {
    html += `
      <div class="alert">
        <p class="alert-title">${escapeHtml(cheapestDeal.condition)} available</p>
        <p class="alert-body">$${cheapestDeal.price.toFixed(2)} at ${escapeHtml(cheapestDeal.store)}</p>
        <p class="alert-meta">via ReSmart</p>
        <a href="${escapeHtml(cheapestDeal.url)}" target="_blank" rel="noopener">View deal</a>
      </div>`;
  } else {
    html += '<p class="empty">No cheaper open-box or refurbished match found yet.</p>';
  }

  root.innerHTML = html;
}

function loadZip() {
  chrome.storage.local.get(RESMART_CONFIG.ZIP_STORAGE_KEY, (data) => {
    document.getElementById("zip-input").value = data[RESMART_CONFIG.ZIP_STORAGE_KEY] ?? "";
  });
}

function saveZip() {
  const zip = document.getElementById("zip-input").value.replace(/[^0-9]/g, "").slice(0, 5);
  chrome.storage.local.set({ [RESMART_CONFIG.ZIP_STORAGE_KEY]: zip });
}

document.getElementById("zip-save").addEventListener("click", saveZip);
loadZip();

chrome.storage.local.get(RESMART_CONFIG.LAST_QUERY_STORAGE_KEY, (data) => {
  renderDeal(data[RESMART_CONFIG.LAST_QUERY_STORAGE_KEY]);
});
