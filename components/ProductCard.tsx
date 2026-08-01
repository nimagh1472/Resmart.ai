"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ExternalLink, Package, TrendingDown, Wallet } from "lucide-react";
import { CONDITIONS, ConditionBadge } from "@/components/ui/badge";
import { BUTTON_MOTION, buttonStyles } from "@/components/ui/button-styles";
import {
  RETAILERS as RETAILER_INFO,
  type RetailerId,
  type CardCondition,
  type ProductCategory,
} from "@/lib/catalog";
import { Sparkline } from "@/components/ui/sparkline";
import { Tooltip } from "@/components/ui/tooltip";
import { trackAffiliateClick } from "@/lib/analytics";
import { cn, formatCurrency } from "@/lib/utils";

// Retailer/condition reference data lives in lib/catalog.ts so server code can
// import it; re-exported here for the components that already consume it.
export {
  RETAILERS,
  type RetailerId,
  type CardCondition,
  type ProductCategory,
} from "@/lib/catalog";

export type Product = {
  id: string;
  brand: string;
  model: string;
  category: ProductCategory;
  image?: string;
  retailer: RetailerId;
  condition: CardCondition;
  /** Manufacturer's suggested price — reference only, not a recent sale price. */
  msrp: number;
  price: number;
  cashback: number;
  /** 90 daily observations, oldest → newest. */
  priceHistory: number[];
  dealUrl: string;
  inStock?: string;
};

/* ------------------------------------------------------------------ */

export interface ProductCardProps {
  product: Product;
  /** Reported with the affiliate click so conversions can be attributed. */
  placement?: string;
  /** Set on above-the-fold cards to skip lazy loading. */
  priority?: boolean;
  className?: string;
}

export function ProductCard({
  product,
  placement = "product-card",
  priority = false,
  className,
}: ProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const {
    brand,
    model,
    image,
    retailer,
    condition,
    msrp,
    price,
    cashback,
    priceHistory,
    dealUrl,
    inStock,
  } = product;

  const savings = msrp - price;
  const savingsPct = msrp > 0 ? Math.round((savings / msrp) * 100) : 0;

  const ninetyDayDelta =
    priceHistory.length > 1
      ? priceHistory[priceHistory.length - 1] - priceHistory[0]
      : 0;

  const retailerInfo = RETAILER_INFO[retailer];
  const conditionInfo = CONDITIONS[condition];

  const handleDealClick = () => {
    trackAffiliateClick({
      productId: product.id,
      retailer,
      condition,
      price,
      msrp,
      cashback,
      dealUrl,
      placement,
    });
  };

  return (
    <article
      className={cn(
        "group flex flex-col rounded-2xl border border-surface-border bg-surface transition-colors hover:border-accent/40",
        className,
      )}
    >
      {/* Image ------------------------------------------------------- */}
      <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-canvas">
        {image && !imageFailed ? (
          <Image
            src={image}
            alt={`${brand} ${model}`}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            onError={() => setImageFailed(true)}
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface to-canvas">
            <Package className="h-10 w-10 text-surface-border" aria-hidden="true" />
          </div>
        )}

        <RetailerBadge
          retailer={retailerInfo}
          className="absolute left-3 top-3"
        />

        {inStock && (
          <span className="absolute bottom-3 right-3 rounded-md bg-canvas/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted backdrop-blur">
            {inStock}
          </span>
        )}
      </div>

      {/* Body -------------------------------------------------------- */}
      <div className="flex flex-1 flex-col gap-3.5 p-4">
        <Tooltip content={conditionInfo.description} side="bottom">
          {/* title="" suppresses the native tooltip the badge sets by default,
              so it doesn't double up with this one. */}
          <ConditionBadge condition={condition} size="sm" title="" />
        </Tooltip>

        <h3 className="font-heading text-sm font-medium leading-snug">
          <span className="text-muted">{brand}</span>{" "}
          <span className="text-foreground">{model}</span>
        </h3>

        {/* Price --------------------------------------------------- */}
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
              ReSmart Open-Box
            </p>
            <p className="font-mono text-2xl font-semibold tabular-nums leading-tight text-foreground">
              {formatCurrency(price)}
            </p>
          </div>

          <Tooltip content="Manufacturer's suggested retail price. Shown for reference only — it is not a recent selling price.">
            <span className="flex cursor-help flex-col items-end">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Retail MSRP
              </span>
              <span className="font-mono text-sm tabular-nums text-muted-foreground line-through decoration-muted-foreground/60">
                {formatCurrency(msrp)}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                Reference only
              </span>
            </span>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-vip/10 px-3 py-2 ring-1 ring-inset ring-vip/25">
          <TrendingDown className="h-4 w-4 shrink-0 text-vip" aria-hidden="true" />
          <p className="font-mono text-sm font-semibold tabular-nums text-vip">
            Save {savingsPct}%{" "}
            <span className="text-vip/70">/</span> {formatCurrency(savings)}
          </p>
        </div>

        {/* 90-day trend -------------------------------------------- */}
        <div className="rounded-xl border border-surface-border bg-canvas/40 p-2.5">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              90-Day Price Trend
            </span>
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums",
                ninetyDayDelta < 0 ? "text-vip" : "text-muted-foreground",
              )}
            >
              {ninetyDayDelta < 0 ? "▼" : ninetyDayDelta > 0 ? "▲" : "—"}{" "}
              {formatCurrency(Math.abs(ninetyDayDelta))}
            </span>
          </div>
          <Sparkline
            data={priceHistory}
            ariaLabel={`90-day price trend for ${brand} ${model}, ${
              ninetyDayDelta < 0 ? "down" : "up"
            } ${formatCurrency(Math.abs(ninetyDayDelta))}`}
          />
        </div>

        {/* Cashback ------------------------------------------------- */}
        <div className="flex items-center gap-2 rounded-xl border border-vip/25 bg-vip/[0.06] px-3 py-2">
          <Wallet className="h-4 w-4 shrink-0 text-vip" aria-hidden="true" />
          <p className="text-xs leading-snug text-muted">
            +{" "}
            <span className="font-mono font-semibold tabular-nums text-vip">
              {formatCurrency(cashback, { cents: true })}
            </span>{" "}
            Cashback for{" "}
            <span className="font-medium text-vip">VIP Members</span>
          </p>
        </div>

        {/* CTA ------------------------------------------------------ */}
        <motion.a
          href={dealUrl}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          onClick={handleDealClick}
          whileHover={BUTTON_MOTION.whileHover}
          whileTap={BUTTON_MOTION.whileTap}
          transition={BUTTON_MOTION.transition}
          className={buttonStyles({ fullWidth: true, className: "mt-auto" })}
        >
          View Deal
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">
            at {retailerInfo.label} (opens in a new tab)
          </span>
        </motion.a>
      </div>
    </article>
  );
}

function RetailerBadge({
  retailer,
  className,
}: {
  retailer: { label: string; color: string; logoSrc?: string };
  className?: string;
}) {
  const { label, color, logoSrc } = retailer;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider backdrop-blur",
        className,
      )}
      style={{
        color,
        borderColor: `${color}40`,
        backgroundColor: `${color}14`,
      }}
    >
      {logoSrc ? (
        <Image src={logoSrc} alt="" width={12} height={12} className="h-3 w-3" />
      ) : (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </span>
  );
}

/** Grid wrapper matching `ProductGridSkeleton`'s columns. */
export function ProductGrid({
  products,
  className,
}: {
  products: Product[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        // 1 col mobile · 2 col tablet · 3 col laptop · 4 col wide desktop
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
