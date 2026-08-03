import { Flame } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import type { Product } from "@/lib/marketplace";

export function LiveProducts({ listings }: { listings: Product[] }) {
  return (
    <section className="px-gutter mx-auto max-w-7xl py-16 sm:py-24">
      <div className="mb-6 flex flex-col gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-strong">
          <Flame className="h-3.5 w-3.5" aria-hidden="true" />
          Live from eBay, Amazon, Best Buy &amp; Walmart
        </span>
        <h2 className="text-balance text-2xl font-bold sm:text-3xl lg:text-4xl">
          Today&apos;s best open-box deals
        </h2>
      </div>

      {listings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Live listings are unavailable right now — check back shortly.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
