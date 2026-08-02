/**
 * Client-side analytics dispatch.
 *
 * Fires on three channels so downstream consumers can pick one without this
 * module taking a dependency on any of them:
 *   1. `window.dataLayer` — GTM / GA4
 *   2. a `resmart:track` CustomEvent on `window` — in-app listeners
 *   3. `navigator.sendBeacon` to `/api/track` — first-party attribution log
 */

export type AnalyticsEvent = {
  name: string;
  payload?: Record<string, unknown>;
};

export type AffiliateClickPayload = {
  productId: string;
  retailer: string;
  condition: string;
  price: number;
  msrp: number;
  cashback: number;
  dealUrl: string;
  /** Where on the page the click originated, e.g. "product-card". */
  placement?: string;
  /** Flat shipping on the chosen offer; 0 when the merchant ships free. */
  shipping?: number;
  /** 1-based position in the best-value ranking the shopper clicked from. */
  offerRank?: number;
  /** How many merchants were on screen when they chose. */
  offerCount?: number;
};

export type CompareClickPayload = {
  productId: string;
  offerCount: number;
  /** Best-value price shown on the card, i.e. the "from" figure. */
  bestPrice: number;
  /** Which surface hosted the card, e.g. "trending-deals". */
  placement?: string;
  /** Which part of the card was clicked. */
  surface?: "image" | "title" | "cta";
};

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function track({ name, payload = {} }: AnalyticsEvent) {
  if (typeof window === "undefined") return;

  const event = { event: name, ...payload };

  window.dataLayer?.push(event);
  window.dispatchEvent(new CustomEvent("resmart:track", { detail: event }));

  // Beacons survive the navigation that an affiliate click triggers; a fetch
  // would be cancelled when the tab leaves for the retailer.
  if (typeof navigator.sendBeacon === "function") {
    try {
      navigator.sendBeacon(
        "/api/track",
        new Blob([JSON.stringify(event)], { type: "application/json" }),
      );
    } catch {
      // Analytics must never break the click-through.
    }
  }
}

export function trackAffiliateClick(payload: AffiliateClickPayload) {
  track({
    name: "affiliate_click",
    payload: {
      ...payload,
      savings: payload.msrp - payload.price,
      placement: payload.placement ?? "product-card",
    },
  });
}

/**
 * An on-platform click into the comparison page. Distinct from
 * `affiliate_click`: no commission is earned here, and the shopper hasn't
 * chosen a merchant yet — this is the top of the comparison funnel.
 */
export function trackCompareClick(payload: CompareClickPayload) {
  track({
    name: "compare_offers_click",
    payload: {
      ...payload,
      placement: payload.placement ?? "product-card",
      surface: payload.surface ?? "cta",
    },
  });
}
