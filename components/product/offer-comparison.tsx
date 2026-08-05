"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ExternalLink, Sparkles, Truck } from "lucide-react";
import { Badge, ConditionBadge } from "@/components/ui/badge";
import { BUTTON_MOTION, buttonStyles } from "@/components/ui/button-styles";
import {
  RETAILERS,
  offerNetCost,
  type MerchantOffer,
  type RetailerId,
} from "@/lib/catalog";
import { trackAffiliateClick } from "@/lib/analytics";
import { cn, formatCurrency, safeExternalUrl } from "@/lib/utils";

export interface OfferComparisonProps {
  productId: string;
  /** "Brand Model" — used for screen-reader context on each Buy Now link. */
  title: string;
  msrp: number;
  /** Already ranked by `sortOffersByValue`; index 0 is the best value. */
  offers: MerchantOffer[];
  className?: string;
}

/**
 * Every merchant carrying this item, ranked by what the shopper actually pays:
 * sticker + shipping. Sticker price alone would promote listings that claw
 * the difference back on delivery, so the total is shown next to the price
 * rather than hidden behind the sort.
 */
export function OfferComparison({
  productId,
  title,
  msrp,
  offers,
  className,
}: OfferComparisonProps) {
  if (offers.length === 0) {
    return (
      <section className={cn("rounded-2xl border border-surface-border bg-surface shadow-card p-6", className)}>
        <h2 className="font-heading text-lg font-semibold">Seller offers</h2>
        <p className="mt-2 text-sm text-muted">
          No merchants are carrying this item right now. Save it and we&apos;ll
          alert you the moment an offer appears.
        </p>
      </section>
    );
  }

  const best = offers[0];
  const bestNet = offerNetCost(best);

  return (
    <section
      aria-labelledby="offers-heading"
      className={cn("flex flex-col gap-4", className)}
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="offers-heading"
            className="font-heading text-xl font-semibold sm:text-2xl"
          >
            Seller offer comparison
          </h2>
          <p className="mt-1 text-sm text-muted">
            {offers.length} merchant{offers.length === 1 ? "" : "s"} carrying
            this item, ranked by total cost after shipping.
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Best total · {formatCurrency(bestNet, { cents: true })}
        </p>
      </header>

      {/* Desktop: a real table, so the columns are comparable at a glance. */}
      <div className="hidden overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-card lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Merchant offers for {title}, best value first.
          </caption>
          <thead>
            <tr className="border-b border-surface-border bg-surface-raised/60">
              {[
                "Merchant",
                "Condition & warranty",
                "Shipping",
                "Open-box price",
                "",
              ].map((label, i) => (
                <th
                  key={label || `actions-${i}`}
                  scope="col"
                  className={cn(
                    "px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground",
                    i >= 3 && "text-right",
                  )}
                >
                  {label || <span className="sr-only">Buy</span>}
                </th>
              ))}
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
                  <MerchantIdentity merchant={offer.merchant} best={i === 0} />
                </td>

                <td className="px-4 py-4 align-middle">
                  <div className="flex flex-col items-start gap-1.5">
                    <ConditionBadge condition={offer.condition} size="sm" />
                    <span className="text-xs text-muted">{offer.warranty}</span>
                    {offer.returns && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {offer.returns}
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4 align-middle">
                  <ShippingBadge shipping={offer.shipping} />
                </td>

                <td className="px-4 py-4 text-right align-middle">
                  <PriceCell offer={offer} msrp={msrp} />
                </td>

                <td className="px-4 py-4 text-right align-middle">
                  <BuyNowButton
                    offer={offer}
                    rank={i}
                    offerCount={offers.length}
                    productId={productId}
                    title={title}
                    msrp={msrp}
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
              <MerchantIdentity merchant={offer.merchant} best={i === 0} />
              <ShippingBadge shipping={offer.shipping} />
            </div>

            <div className="flex flex-col items-start gap-1.5">
              <ConditionBadge condition={offer.condition} size="sm" />
              <span className="text-xs text-muted">{offer.warranty}</span>
              {offer.returns && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {offer.returns}
                </span>
              )}
            </div>

            <div className="flex items-end justify-between gap-3 border-t border-surface-border/70 pt-3">
              <div className="text-left">
                <PriceCell offer={offer} msrp={msrp} align="left" />
              </div>
            </div>

            <BuyNowButton
              offer={offer}
              rank={i}
              offerCount={offers.length}
              productId={productId}
              title={title}
              msrp={msrp}
              fullWidth
            />
          </li>
        ))}
      </ul>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Prices, stock and shipping are captured from each merchant when this
        page loads and can change before checkout — always confirm on the
        merchant&apos;s site. ReSmart may earn a commission on these links,
        which never changes the price you pay or the order above.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Cells                                                               */
/* ------------------------------------------------------------------ */

/** Two letters from the merchant name, for the logo-less fallback tile. */
function initials(label: string) {
  const words = label.split(" ").filter(Boolean);
  return (
    words.length > 1
      ? `${words[0][0]}${words[1][0]}`
      : label.slice(0, 2)
  ).toUpperCase();
}

function MerchantIdentity({
  merchant,
  best,
}: {
  merchant: RetailerId;
  best: boolean;
}) {
  const { label, color, logoSrc } = RETAILERS[merchant];

  return (
    <div className="flex items-center gap-3">
      {logoSrc ? (
        <Image
          src={logoSrc}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-lg object-contain"
        />
      ) : (
        // Licensed marks aren't bundled; a monogram in the brand color keeps
        // merchants distinguishable without shipping someone else's logo.
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-semibold"
          style={{
            color,
            borderColor: `${color}40`,
            backgroundColor: `${color}14`,
          }}
        >
          {initials(label)}
        </span>
      )}

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        {best && (
          <Badge
            tone="emerald"
            size="sm"
            icon={<Sparkles className="h-3 w-3" aria-hidden="true" />}
            className="mt-1"
          >
            Best Value
          </Badge>
        )}
      </div>
    </div>
  );
}

function ShippingBadge({ shipping }: { shipping: number }) {
  const free = shipping <= 0;

  return (
    <Badge
      tone={free ? "emerald" : "slate"}
      size="sm"
      icon={<Truck className="h-3 w-3" aria-hidden="true" />}
    >
      {free ? "Free Shipping" : `${formatCurrency(shipping)} Shipping`}
    </Badge>
  );
}

function PriceCell({
  offer,
  msrp,
  align = "right",
}: {
  offer: MerchantOffer;
  msrp: number;
  align?: "left" | "right";
}) {
  const net = offerNetCost(offer);
  const off = msrp > 0 ? Math.round(((msrp - offer.price) / msrp) * 100) : 0;

  return (
    <div className={cn("flex flex-col", align === "right" && "items-end")}>
      <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
        {formatCurrency(offer.price)}
      </span>
      {off > 0 && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-vip-strong">
          {off}% off MSRP
        </span>
      )}
      <span className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
        {formatCurrency(net, { cents: true })} total
      </span>
    </div>
  );
}

function BuyNowButton({
  offer,
  rank,
  offerCount,
  productId,
  title,
  msrp,
  fullWidth = false,
}: {
  offer: MerchantOffer;
  rank: number;
  offerCount: number;
  productId: string;
  title: string;
  msrp: number;
  fullWidth?: boolean;
}) {
  const merchantLabel = RETAILERS[offer.merchant].label;
  // Merchant feeds are untrusted input; anything that isn't an absolute
  // http(s) URL never reaches an href.
  const href = safeExternalUrl(offer.dealUrl);

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
          retailer: offer.merchant,
          condition: offer.condition,
          price: offer.price,
          msrp,
          dealUrl: href,
          shipping: offer.shipping,
          offerRank: rank + 1,
          offerCount,
          placement: "offer-comparison",
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
        — {title} at {merchantLabel} for {formatCurrency(offer.price)} (opens in
        a new tab)
      </span>
    </motion.a>
  );
}
