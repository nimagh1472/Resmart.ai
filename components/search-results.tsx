"use client";

import { useEffect, useState } from "react";
import { SearchX, TriangleAlert } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import type { Product } from "@/lib/marketplace";

type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: Product[] };

/**
 * Fetches `/api/products/search?q=` for whatever the shopper typed — any
 * keyword, not just the mock catalog — and renders the live results merged
 * across eBay, Amazon, Best Buy, and Walmart. Client-rendered (rather than a
 * server component) so the query can change without a full navigation and
 * so the loading state is explicit.
 */
export function SearchResults({ query }: { query: string }) {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    if (!query) {
      setState({ status: "ready", items: [] });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    fetch(`/api/products/search?q=${encodeURIComponent(query)}&limit=24`)
      .then(async (res) => {
        if (!res.ok) throw new Error("upstream_error");
        const json = await res.json();
        return json.items as Product[];
      })
      .then((items) => {
        if (!cancelled) setState({ status: "ready", items });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <section className="px-gutter mx-auto max-w-7xl py-10 sm:py-14">
      <div className="mb-6 flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-strong">
          Live search results
        </span>
        <h1 className="text-balance text-2xl font-bold sm:text-3xl">
          {query ? `Results for "${query}"` : "Search open-box and refurbished inventory"}
        </h1>
      </div>

      {!query ? (
        <p className="text-sm text-muted-foreground">
          Type a product name above to pull live listings from eBay, Amazon,
          Best Buy, and Walmart.
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
      ) : state.items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-2xl border border-surface-border bg-surface p-4 text-sm text-muted-foreground">
          <SearchX
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          No live listings found for &ldquo;{query}&rdquo;. Try a different
          keyword.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {state.items.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
