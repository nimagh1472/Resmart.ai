import type { Store } from "@/lib/marketplace";
import type { RetailerId } from "@/lib/catalog";
import type { MerchantOffer } from "@/lib/catalog";
import { sortOffersByValue } from "@/lib/catalog";

/**
 * In-memory global config for per-store VIP cashback rates.
 *
 * Stands in for a `platform_settings.cashback_rates` column until Supabase is
 * wired up (see `app/api/admin/route.ts`, which write-throughs here either
 * way) — the same pattern `lib/merchant-store.ts` uses for merchant KYC.
 * Pinned to `globalThis` so the dev server's hot reload doesn't reset a
 * saved rate back to the default between requests.
 *
 * Values are percentage points (e.g. `2.0` means 2.00%), matching what the
 * admin sliders display directly — not a 0–1 fraction.
 */

export const CASHBACK_STORES: Store[] = [
  "eBay",
  "Amazon",
  "Best Buy",
  "Walmart",
  "Target",
];

export type CashbackRates = Record<Store, number>;

export const DEFAULT_CASHBACK_RATES: CashbackRates = {
  eBay: 2.0,
  Amazon: 1.0,
  "Best Buy": 1.5,
  Walmart: 1.0,
  Target: 1.0,
};

export const CASHBACK_RATE_BOUNDS = { min: 0, max: 3, step: 0.25 } as const;

/** Rate applied to retailers outside the five VIP-cashback-eligible stores. */
export const FALLBACK_CASHBACK_RATE = 1.0;

type RatesState = { rates: CashbackRates };

const globalStore = globalThis as typeof globalThis & {
  __resmartCashbackRates?: RatesState;
};

const state: RatesState =
  globalStore.__resmartCashbackRates ??
  (globalStore.__resmartCashbackRates = { rates: { ...DEFAULT_CASHBACK_RATES } });

export function getCashbackRates(): CashbackRates {
  return { ...state.rates };
}

/** Merges a partial patch in and returns the resulting full rate set. */
export function setCashbackRates(patch: Partial<CashbackRates>): CashbackRates {
  state.rates = { ...state.rates, ...patch };
  return { ...state.rates };
}

export function isValidCashbackRate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= CASHBACK_RATE_BOUNDS.min &&
    value <= CASHBACK_RATE_BOUNDS.max
  );
}

/** The curated catalog's kebab-case ids map onto the live `Store` labels the admin rates key on. */
const RETAILER_TO_STORE: Partial<Record<RetailerId, Store>> = {
  "best-buy": "Best Buy",
  ebay: "eBay",
  walmart: "Walmart",
  "amazon-warehouse": "Amazon",
};

export function rateForRetailer(
  retailer: RetailerId,
  rates: CashbackRates = getCashbackRates(),
): number {
  const mapped = RETAILER_TO_STORE[retailer];
  return mapped ? rates[mapped] : FALLBACK_CASHBACK_RATE;
}

export function rateForStore(
  store: Store,
  rates: CashbackRates = getCashbackRates(),
): number {
  return rates[store];
}

/** `ratePercent` is a percentage point value (2.0 = 2%), not a fraction. */
export function computeCashback(price: number, ratePercent: number): number {
  return Math.round(price * (ratePercent / 100) * 100) / 100;
}

/** Average rate across the five stores, as a 0–1 fraction — used for aggregate financial projections. */
export function averageCashbackFraction(rates: CashbackRates): number {
  const values = CASHBACK_STORES.map((s) => rates[s]);
  return values.reduce((a, b) => a + b, 0) / values.length / 100;
}

/**
 * Recomputes each offer's cashback from the live per-retailer rate and
 * re-sorts by net cost, so a curated-catalog product page reflects a rate
 * change on the very next render rather than the value baked in at server
 * start.
 */
export function applyLiveCashback(
  offers: MerchantOffer[],
  rates: CashbackRates = getCashbackRates(),
): MerchantOffer[] {
  const priced = offers.map((offer) => ({
    ...offer,
    cashback: computeCashback(offer.price, rateForRetailer(offer.merchant, rates)),
  }));
  return sortOffersByValue(priced);
}
