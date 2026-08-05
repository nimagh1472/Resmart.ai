/**
 * Reference data for live marketplace listings (`lib/marketplace.ts`).
 *
 * Serper Shopping doesn't expose structured shipping, pickup, condition, or
 * return data per listing — every store's `condition` comes back `null`.
 * `perks` and `warranty`
 * below are each retailer's general published policy, not a per-listing
 * guarantee — shown as "typically offered" rather than confirmed for the
 * specific item, and worth re-verifying on the retailer's own page.
 */

import type { BadgeTone } from "@/components/ui/badge";
import type { Store } from "@/lib/marketplace";

export const STORE_INFO: Record<
  Store,
  { color: string; perks: string[]; warranty: string }
> = {
  eBay: {
    color: "#B91C1C",
    perks: ["Free shipping (most listings)", "30-day returns (most sellers)"],
    warranty: "eBay Money Back Guarantee",
  },
  Amazon: {
    color: "#B45309",
    perks: ["Free Prime shipping (eligible orders)", "Same-day delivery (select areas)"],
    warranty: "Amazon standard 30-day return policy",
  },
  "Best Buy": {
    color: "#1D4ED8",
    perks: ["Free shipping ($35+)", "Free store pick-up", "Same-day delivery (select areas)"],
    warranty: "Best Buy 15-day return & exchange promise",
  },
  Walmart: {
    color: "#0369A1",
    perks: ["Free shipping ($35+)", "Free store pick-up", "Same-day delivery (select areas)"],
    warranty: "Walmart 90-day return policy",
  },
  Target: {
    color: "#CC0000",
    perks: ["Free shipping ($35+)", "Free store pick-up", "Same-day delivery via Shipt (select areas)"],
    warranty: "Target 90-day return policy",
  },
};

/**
 * Whether a store's general shipping policy includes a free-shipping
 * threshold, for the comparison table's "Shipping Status" column. Falls back
 * to a neutral "check store" status for any store outside `STORE_INFO`.
 */
export function shippingStatus(store: Store): { label: string; free: boolean } {
  const perks = STORE_INFO[store]?.perks ?? [];
  const freePerk = perks.find((perk) => /free (shipping|prime shipping)/i.test(perk));
  return freePerk ? { label: freePerk, free: true } : { label: "Check store for shipping", free: false };
}

export type ConditionTag = { label: string; tone: BadgeTone };

/**
 * Normalizes the free-text condition strings retailers use ("Certified -
 * Refurbished", "Open box", "Pre-owned", ...) into one of the tags ReSmart
 * standardizes on. Falls back to the raw string, untranslated, rather than
 * guessing at a bucket it doesn't clearly match.
 */
export function normalizeCondition(raw: string | null): ConditionTag {
  if (!raw || raw.trim().length === 0 || /not specified/i.test(raw)) {
    return { label: "Condition not specified", tone: "slate" };
  }

  const value = raw.toLowerCase();

  if (/open.?box/.test(value)) {
    return { label: "Open-Box", tone: "emerald" };
  }
  if (/refurb|certified/.test(value)) {
    return { label: "Certified Refurbished", tone: "sky" };
  }
  if (/like new|excellent/.test(value)) {
    return { label: "Like New", tone: "teal" };
  }
  if (/^new$|brand new/.test(value)) {
    return { label: "New", tone: "slate" };
  }
  if (/used|pre-?owned|good|acceptable/.test(value)) {
    return { label: raw, tone: "amber" };
  }
  if (/parts|not working|damaged/.test(value)) {
    return { label: raw, tone: "rose" };
  }

  return { label: raw, tone: "slate" };
}
