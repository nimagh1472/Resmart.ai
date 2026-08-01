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
  | "amazon-warehouse";

export type ProductCategory =
  | "laptops"
  | "cameras"
  | "headphones"
  | "consoles";

/** ReSmart only surfaces graded, warranty-backed stock. */
export type CardCondition = "open-box-excellent" | "certified-refurbished";

/**
 * Brand colors are lightened from each retailer's official palette so they
 * stay legible on the Deep Void canvas. `logoSrc` is intentionally empty —
 * real retailer marks are licensed assets and must be supplied per-deployment.
 */
export const RETAILERS: Record<
  RetailerId,
  { label: string; color: string; logoSrc?: string }
> = {
  "best-buy": { label: "Best Buy", color: "#FFE000" },
  ebay: { label: "eBay", color: "#7CB9F2" },
  walmart: { label: "Walmart", color: "#FFC220" },
  "amazon-warehouse": { label: "Amazon Warehouse", color: "#FF9900" },
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
};
