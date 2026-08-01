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
