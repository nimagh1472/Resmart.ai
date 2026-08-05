"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPinOff, Package, SearchX, TriangleAlert } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { ConditionBadge } from "@/components/ui/badge";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { productHref } from "@/components/ProductCard";
import type { ProductGroup } from "@/lib/marketplace";
import type { CardCondition } from "@/lib/catalog";
import type { SearchFilters } from "@/components/search-control-panel";
import { formatCurrency } from "@/lib/utils";

/** Shape returned by GET /api/products for the curated-catalog branch. */
type CuratedItem = {
  id: string;
  title: string;
  condition: CardCondition;
  conditionLabel: string;
  retailer: { name: string };
  pricing: { msrp: number; price: number; savings: number; savingsPercent: number };
  availability: string;
};

type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "fulfillment-unavailable" }
  | { status: "ready"; source: "live"; items: ProductGroup[] }
  | { status: "ready"; source: "curated"; items: CuratedItem[] };

/**
 * Fetches results for whatever the shopper typed plus the active filters, and
 * renders them. Two data sources feed this, switched on `filters.condition`:
 *
 *   - Anything except "Brand New" hits `/api/products/search` — the live
 *     cross-retailer feed (eBay, Amazon, Best Buy, Walmart, Target). That
 *     pipeline never carries brand-new inventory by design (see
 *     lib/marketplace.ts), so it only supports the Refurbished and Open
 *     Box/Pre-owned buckets.
 *   - "Brand New" hits `/api/products` instead — ReSmart's own curated
 *     catalog, the only place brand-new stock is tracked.
 *
 * Client-rendered (rather than a server component) so filters can change
 * without a full navigation and so the loading state is explicit.
 */
export function SearchResults({
  query,
  filters,
}: {
  query: string;
  filters: SearchFilters;
}) {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    if (!query) {
      setState({ status: "ready", source: "live", items: [] });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    const isBrandNew = filters.condition === "brand-new";

    const url = isBrandNew
      ? (() => {
          const params = new URLSearchParams({ q: query, limit: "24", condition: "brand-new" });
          if (filters.fulfillment !== "all") params.set("fulfillment", filters.fulfillment);
          if (filters.zip) params.set("zip", filters.zip);
          return `/api/products?${params.toString()}`;
        })()
      : (() => {
          const params = new URLSearchParams({ q: query, limit: "24" });
          if (filters.condition !== "all") params.set("condition", filters.condition);
          if (filters.fulfillment !== "all") params.set("fulfillment", filters.fulfillment);
          if (filters.zip) params.set("zip", filters.zip);
          return `/api/products/search?${params.toString()}`;
        })();

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error("upstream_error");
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        if (json.fulfillmentUnavailable) {
          setState({ status: "fulfillment-unavailable" });
        } else if (isBrandNew) {
          setState({ status: "ready", source: "curated", items: json.items as CuratedItem[] });
        } else {
          setState({ status: "ready", source: "live", items: json.items as ProductGroup[] });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [query, filters.condition, filters.fulfillment, filters.zip]);

  return (
    <section className="px-gutter mx-auto max-w-7xl py-10 sm:py-14">
      <div className="mb-6 flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-strong">
          {state.status === "ready" && state.source === "curated"
            ? "ReSmart curated catalog"
            : "Live search results"}
        </span>
        <h1 className="text-balance text-2xl font-bold sm:text-3xl">
          {query ? `Results for "${query}"` : "Search open-box and refurbished inventory"}
        </h1>
      </div>

      {!query ? (
        <p className="text-sm text-muted-foreground">
          Type a product name above to pull live listings from eBay, Amazon,
          Best Buy, Walmart, and Target.
        </p>
      ) : state.status === "loading" ? (
        <ProductGridSkeleton count={12} />
      ) : state.status === "error" ? (
        <div className="flex items-center gap-2 rounded-2xl border border-surface-border bg-surface p-4 text-sm text-muted-foreground">
          <TriangleAlert
            className="h-4 w-4 shrink-0 text-vip-strong"
            aria-hidden="true"
          />
          Live results are unavailable right now — try again shortly.
        </div>
      ) : state.status === "fulfillment-unavailable" ? (
        <div className="flex items-center gap-2 rounded-2xl border border-surface-border bg-surface p-4 text-sm text-muted-foreground">
          <MapPinOff
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          No in-store pickup listings yet{filters.zip ? ` near ${filters.zip}` : ""} —
          every result today ships to you. Switch Fulfillment to &ldquo;Direct
          Shipping&rdquo; or &ldquo;All&rdquo; to see them.
        </div>
      ) : state.items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-2xl border border-surface-border bg-surface p-4 text-sm text-muted-foreground">
          <SearchX
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          No {state.source === "curated" ? "brand-new" : "live"} listings found
          for &ldquo;{query}&rdquo;. Try a different keyword or condition.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {state.source === "curated"
            ? state.items.map((item) => <CuratedResultCard key={item.id} item={item} />)
            : state.items.map((group) => <ListingCard key={group.id} group={group} />)}
        </div>
      )}
    </section>
  );
}

function CuratedResultCard({ item }: { item: CuratedItem }) {
  return (
    <article className="group flex flex-col rounded-2xl border border-surface-border bg-surface shadow-card transition-colors hover:border-accent/40">
      <Link
        href={productHref(item.id)}
        aria-label={`${item.title} — compare deals and details`}
        className="relative flex aspect-square items-center justify-center overflow-hidden rounded-t-2xl bg-gradient-to-br from-surface to-canvas focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <Package className="h-10 w-10 text-surface-border" aria-hidden="true" />
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <ConditionBadge condition={item.condition} size="sm" />

        <h3 className="font-heading text-sm font-medium leading-snug">
          <Link
            href={productHref(item.id)}
            className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {item.title}
          </Link>
        </h3>

        <div className="flex items-end justify-between gap-3">
          <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
            {formatCurrency(item.pricing.price)}
          </span>
          {item.pricing.savingsPercent > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-vip-strong">
              {item.pricing.savingsPercent}% off MSRP
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Sold by {item.retailer.name} · {item.availability}
        </p>

        <Link
          href={productHref(item.id)}
          className="mt-auto inline-flex items-center justify-center gap-1 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          View deal
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
