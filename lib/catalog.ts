/**
 * Retailer and condition reference data.
 *
 * Lives outside `components/ProductCard.tsx` because that file is
 * `"use client"` — a route handler importing a value from a client module
 * receives a client-reference stub, not the object.
 */

export type RetailerId =
  | "best-buy"
  | "ebay"
  | "walmart"
  | "amazon-warehouse"
  | "back-market"
  | "newegg"
  | "gamestop"
  | "adorama";

export type ProductCategory =
  | "laptops"
  | "cameras"
  | "headphones"
  | "consoles"
  | "tvs"
  | "appliances";

/** ReSmart only surfaces graded, warranty-backed stock. */
export type CardCondition =
  | "open-box-excellent"
  | "certified-refurbished"
  | "like-new";

/**
 * Brand colors are deepened from each retailer's official palette so the badge
 * label stays readable as text on the white card surface — the published
 * yellows and pastels sit far below 4.5:1 there. `logoSrc` is intentionally
 * empty — real retailer marks are licensed assets and must be supplied
 * per-deployment; until one is, the UI falls back to a monogram tile in the
 * brand color.
 *
 * `home` is the storefront root, used as the affiliate destination for
 * comparison offers that have no deep link of their own.
 */
export const RETAILERS: Record<
  RetailerId,
  { label: string; color: string; home: string; logoSrc?: string }
> = {
  "best-buy": {
    label: "Best Buy",
    color: "#1D4ED8",
    home: "https://www.bestbuy.com/",
  },
  ebay: { label: "eBay", color: "#B91C1C", home: "https://www.ebay.com/" },
  walmart: {
    label: "Walmart",
    color: "#0369A1",
    home: "https://www.walmart.com/",
  },
  "amazon-warehouse": {
    label: "Amazon Warehouse",
    color: "#B45309",
    home: "https://www.amazon.com/",
  },
  "back-market": {
    label: "Back Market",
    color: "#0F766E",
    home: "https://www.backmarket.com/",
  },
  newegg: { label: "Newegg", color: "#C2410C", home: "https://www.newegg.com/" },
  gamestop: {
    label: "GameStop",
    color: "#6D28D9",
    home: "https://www.gamestop.com/",
  },
  adorama: {
    label: "Adorama",
    color: "#A21CAF",
    home: "https://www.adorama.com/",
  },
};

/** Condition metadata exposed over the API (distinct from the badge's UI copy). */
export const CONDITIONS_API: Record<
  CardCondition,
  { label: string; warranty: string; description: string }
> = {
  "open-box-excellent": {
    label: "Open-Box Excellent",
    warranty: "90-day retailer warranty",
    description: "Opened but unused, in as-new cosmetic condition.",
  },
  "certified-refurbished": {
    label: "Certified Refurbished",
    warranty: "1-year manufacturer warranty",
    description: "Professionally restored and tested to manufacturer spec.",
  },
  "like-new": {
    label: "Like New",
    warranty: "6-month seller warranty",
    description: "Lightly used with no visible wear.",
  },
};

/* ------------------------------------------------------------------ */
/* Merchant offers                                                     */
/* ------------------------------------------------------------------ */

/**
 * One merchant's listing for a product. A product page shows several of these
 * side by side; the card shows only the best-value one.
 */
export type MerchantOffer = {
  /** Unique within a product — used as the React key and in click attribution. */
  id: string;
  merchant: RetailerId;
  condition: CardCondition;
  /** Coverage as the merchant states it, e.g. "1-Year Apple Warranty". */
  warranty: string;
  /** Sticker price, before shipping and before cashback. */
  price: number;
  /** Flat shipping cost in dollars; 0 renders as "Free Shipping". */
  shipping: number;
  /** VIP wallet credit earned on this offer, in dollars. */
  cashback: number;
  /**
   * Outbound affiliate destination. Never rendered directly — pass it through
   * `safeExternalUrl` first, which drops anything that isn't http(s).
   */
  dealUrl: string;
  /** Free-text availability, e.g. "4 in stock". */
  stock?: string;
  /** Return policy summary, e.g. "30-day returns". */
  returns?: string;
};

/**
 * What the buyer actually parts with: sticker + shipping, less the cashback
 * that lands back in their wallet. This — not the sticker price — is what the
 * comparison table ranks on, because a $10 cheaper listing with $15 shipping
 * is not a better deal.
 */
export function offerNetCost(offer: MerchantOffer): number {
  return Math.round((offer.price + offer.shipping - offer.cashback) * 100) / 100;
}

/**
 * Best value first. Ties break on sticker price, then cashback, then merchant
 * id — a plain codepoint comparison rather than `localeCompare`, so the server
 * and the client can never disagree about the order and trip a hydration
 * mismatch. Returns a new array; the input is left alone.
 */
export function sortOffersByValue(offers: MerchantOffer[]): MerchantOffer[] {
  return [...offers].sort(
    (a, b) =>
      offerNetCost(a) - offerNetCost(b) ||
      a.price - b.price ||
      b.cashback - a.cashback ||
      (a.merchant < b.merchant ? -1 : a.merchant > b.merchant ? 1 : 0),
  );
}

/**
 * The warranty a grade implies when a merchant hasn't stated its own. Certified
 * refurbished stock carries manufacturer coverage, so it names the brand;
 * everything else is backed by the store.
 */
export function defaultWarranty(
  brand: string,
  condition: CardCondition,
): string {
  switch (condition) {
    case "certified-refurbished":
      return `1-Year ${brand} Warranty`;
    case "like-new":
      return "6-Month Store Warranty";
    default:
      return "90-Day Store Warranty";
  }
}
