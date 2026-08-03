"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { ProductCard, type Product, type ProductCategory } from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS } from "@/lib/mock-products";
import { cn } from "@/lib/utils";

type Filter = "all" | ProductCategory;

const FILTERS: Filter[] = [
  "all",
  "laptops",
  "cameras",
  "headphones",
  "consoles",
];

export function TrendingDeals({
  products,
  loading = false,
}: {
  products: Product[];
  loading?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () =>
      filter === "all"
        ? products
        : products.filter((p) => p.category === filter),
    [products, filter],
  );

  return (
    <section className="px-gutter mx-auto max-w-7xl py-16 sm:py-24">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-strong">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            Trending now
          </span>
          <h2 className="text-balance text-2xl font-bold sm:text-3xl lg:text-4xl">
            Today&apos;s best open-box deals
          </h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Updated hourly
        </span>
      </div>

      <div
        role="tablist"
        aria-label="Filter deals by category"
        className="mb-6 flex flex-wrap gap-2"
      >
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f)}
              className={cn(
                "relative rounded-full border px-3.5 py-1.5 text-xs transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active
                  ? "border-accent/50 text-accent-strong"
                  : "border-surface-border text-muted hover:border-accent/30 hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="deal-filter-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-accent/10"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {f === "all" ? "All" : CATEGORY_LABELS[f]}
            </button>
          );
        })}
      </div>

      {loading ? (
        <ProductGridSkeleton count={8} />
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {visible.map((p, i) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: Math.min(i, 7) * 0.04 }}
            >
              <ProductCard
                product={p}
                priority={i < 4}
                placement="trending-deals"
                className="h-full"
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  );
}
