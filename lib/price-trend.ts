import type { Product } from "@/lib/marketplace";

export type PriceTrend = {
  series: number[];
  label: string;
  tone: "auto" | "neutral";
};

/**
 * The Serper Shopping feed is a live snapshot, not a historical price series —
 * there's no real "90-day trend" to show for a marketplace search result.
 * Rather than fabricate one, this builds the most honest visual available
 * from what's on hand:
 *
 *   1. If the anchor listing has a list price above its current price,
 *      interpolate the markdown from list → current (a real discount, shown
 *      as a short trend rather than pretended to be a longer history).
 *   2. Otherwise, if other retailers are carrying the item at different
 *      prices, show the spread across them (a real signal, just not a
 *      time series).
 *   3. Otherwise there's nothing meaningful to chart — the caller should
 *      show a "not enough data yet" message instead.
 */
export function estimatePriceTrend(
  anchor: Product,
  offers: Product[],
): PriceTrend | null {
  if (anchor.originalPrice && anchor.originalPrice > anchor.price) {
    const steps = 6;
    const series = Array.from({ length: steps }, (_, i) => {
      const t = i / (steps - 1);
      return Math.round((anchor.originalPrice! + (anchor.price - anchor.originalPrice!) * t) * 100) / 100;
    });
    return {
      series,
      label: "Recent markdown — list price → today's price",
      tone: "auto",
    };
  }

  const distinctPrices = Array.from(new Set(offers.map((o) => o.price))).sort((a, b) => a - b);
  if (distinctPrices.length > 1) {
    return {
      series: distinctPrices,
      label: "Price spread across retailers carrying this item today",
      tone: "neutral",
    };
  }

  return null;
}
