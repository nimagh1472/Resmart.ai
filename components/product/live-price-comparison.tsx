"use client";

import { ExternalLink, ShieldCheck, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BUTTON_MOTION, buttonStyles } from "@/components/ui/button-styles";
import { motion } from "framer-motion";
import type { Product } from "@/lib/marketplace";
import { normalizeCondition, STORE_INFO } from "@/lib/store-info";
import { trackAffiliateClick } from "@/lib/analytics";
import { cn, formatCurrency, safeExternalUrl } from "@/lib/utils";

export interface LivePriceComparisonProps {
  productId: string;
  title: string;
  /** One representative (cheapest) listing per store, already sorted by price. */
  offers: Product[];
  className?: string;
}

/**
 * Live cross-store price comparison for a marketplace search result — the
 * same idea as `OfferComparison` for the curated catalog, but built on raw
 * `Product` listings pulled live from eBay, Amazon, Best Buy, and Walmart
 * rather than a fixed merchant offer list.
 */
export function LivePriceComparison({
  productId,
  title,
  offers,
  className,
}: LivePriceComparisonProps) {
  if (offers.length === 0) {
    return (
      <section className={cn("rounded-2xl border border-surface-border bg-surface shadow-card p-6", className)}>
        <h2 className="font-heading text-lg font-semibold">Retailer price comparison</h2>
        <p className="mt-2 text-sm text-muted">
          No live listings matched this item just now — retailer inventory
          changes constantly, so try refreshing in a moment.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="live-offers-heading"
      className={cn("flex flex-col gap-4", className)}
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="live-offers-heading"
            className="font-heading text-xl font-semibold sm:text-2xl"
          >
            Live retailer price comparison
          </h2>
          <p className="mt-1 text-sm text-muted">
            {offers.length} retailer{offers.length === 1 ? "" : "s"} carrying
            this item right now, cheapest first.
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Best price · {formatCurrency(offers[0].price)}
        </p>
      </header>

      {/* Desktop: a real table. */}
      <div className="hidden overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-card lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Live retailer offers for {title}, cheapest first.
          </caption>
          <thead>
            <tr className="border-b border-surface-border bg-surface-raised/60">
              {["Retailer", "Condition", "Delivery & perks", "Price", ""].map(
                (label, i) => (
                  <th
                    key={label || `actions-${i}`}
                    scope="col"
                    className={cn(
                      "px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground",
                      i === 3 && "text-right",
                    )}
                  >
                    {label || <span className="sr-only">Buy</span>}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {offers.map((offer, i) => (
              <tr
                key={offer.id}
                className={cn(
                  "border-b border-surface-border/70 last:border-b-0 transition-colors hover:bg-surface-raised/40",
                  i === 0 && "bg-vip/[0.04]",
                )}
              >
                <td className="px-4 py-4 align-middle">
                  <StoreIdentity store={offer.store} best={i === 0} />
                </td>
                <td className="px-4 py-4 align-middle">
                  <ConditionCell condition={offer.condition} />
                </td>
                <td className="px-4 py-4 align-middle">
                  <PerksCell store={offer.store} />
                </td>
                <td className="px-4 py-4 text-right align-middle">
                  <PriceCell offer={offer} />
                </td>
                <td className="px-4 py-4 text-right align-middle">
                  <BuyNowButton
                    offer={offer}
                    rank={i}
                    offerCount={offers.length}
                    productId={productId}
                    title={title}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet: the same rows, stacked. */}
      <ul className="flex flex-col gap-3 lg:hidden">
        {offers.map((offer, i) => (
          <li
            key={offer.id}
            className={cn(
              "flex flex-col gap-3 rounded-2xl border bg-surface p-4",
              i === 0
                ? "border-vip/40 bg-vip/[0.04]"
                : "border-surface-border",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <StoreIdentity store={offer.store} best={i === 0} />
              <PriceCell offer={offer} align="right" />
            </div>
            <ConditionCell condition={offer.condition} />
            <PerksCell store={offer.store} />
            <BuyNowButton
              offer={offer}
              rank={i}
              offerCount={offers.length}
              productId={productId}
              title={title}
              fullWidth
            />
          </li>
        ))}
      </ul>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Prices and availability are pulled live from each retailer&apos;s
        public listings and can change before checkout — always confirm on
        the retailer&apos;s site. Delivery options and return windows shown
        are each retailer&apos;s general policy, not a guarantee for this
        specific listing.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function initials(label: string) {
  const words = label.split(" ").filter(Boolean);
  return (
    words.length > 1 ? `${words[0][0]}${words[1][0]}` : label.slice(0, 2)
  ).toUpperCase();
}

function StoreIdentity({ store, best }: { store: Product["store"]; best: boolean }) {
  const { color } = STORE_INFO[store];

  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-semibold"
        style={{ color, borderColor: `${color}40`, backgroundColor: `${color}14` }}
      >
        {initials(store)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{store}</p>
        {best && (
          <Badge tone="emerald" size="sm" className="mt-1">
            Best Price
          </Badge>
        )}
      </div>
    </div>
  );
}

function ConditionCell({ condition }: { condition: string | null }) {
  const { label, tone } = normalizeCondition(condition);
  return (
    <Badge tone={tone} size="sm">
      {label}
    </Badge>
  );
}

function PerksCell({ store }: { store: Product["store"] }) {
  const { perks, warranty } = STORE_INFO[store];

  return (
    <div className="flex max-w-[16rem] flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {perks.map((perk) => (
          <Badge key={perk} tone="slate" size="sm" icon={<Truck className="h-3 w-3" aria-hidden="true" />}>
            {perk}
          </Badge>
        ))}
      </div>
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
        {warranty}
      </span>
    </div>
  );
}

function PriceCell({
  offer,
  align = "right",
}: {
  offer: Product;
  align?: "left" | "right";
}) {
  const off =
    offer.originalPrice && offer.originalPrice > offer.price
      ? Math.round(((offer.originalPrice - offer.price) / offer.originalPrice) * 100)
      : 0;

  return (
    <div className={cn("flex flex-col", align === "right" && "items-end")}>
      <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
        {formatCurrency(offer.price)}
      </span>
      {offer.originalPrice && offer.originalPrice > offer.price && (
        <span className="font-mono text-xs tabular-nums text-muted-foreground line-through">
          {formatCurrency(offer.originalPrice)}
        </span>
      )}
      {off > 0 && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-vip-strong">
          {off}% off
        </span>
      )}
    </div>
  );
}

function BuyNowButton({
  offer,
  rank,
  offerCount,
  productId,
  title,
  fullWidth = false,
}: {
  offer: Product;
  rank: number;
  offerCount: number;
  productId: string;
  title: string;
  fullWidth?: boolean;
}) {
  // Live listing URLs come straight from each retailer's public feed —
  // untrusted input, so anything that isn't an absolute http(s) URL never
  // reaches an href.
  const href = safeExternalUrl(offer.url);

  if (!href) {
    return (
      <span
        className={buttonStyles({
          variant: "secondary",
          size: "sm",
          fullWidth,
          className: "cursor-not-allowed opacity-50",
        })}
        aria-disabled="true"
      >
        Unavailable
      </span>
    );
  }

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      onClick={() =>
        trackAffiliateClick({
          productId,
          retailer: offer.store,
          condition: offer.condition ?? "not specified",
          price: offer.price,
          msrp: offer.originalPrice ?? offer.price,
          cashback: 0,
          dealUrl: href,
          offerRank: rank + 1,
          offerCount,
          placement: "live-price-comparison",
        })
      }
      whileHover={BUTTON_MOTION.whileHover}
      whileTap={BUTTON_MOTION.whileTap}
      transition={BUTTON_MOTION.transition}
      className={buttonStyles({
        variant: rank === 0 ? "primary" : "secondary",
        size: "sm",
        fullWidth,
      })}
    >
      Buy Now
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">
        — {title} at {offer.store} for {formatCurrency(offer.price)} (opens in
        a new tab)
      </span>
    </motion.a>
  );
}
