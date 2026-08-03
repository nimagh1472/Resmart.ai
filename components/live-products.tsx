import { Flame, Package } from "lucide-react";
import type { EbayListing } from "@/lib/ebay";
import { formatCurrency } from "@/lib/utils";

export function LiveProducts({ listings }: { listings: EbayListing[] }) {
  return (
    <section className="px-gutter mx-auto max-w-7xl py-16 sm:py-24">
      <div className="mb-6 flex flex-col gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-strong">
          <Flame className="h-3.5 w-3.5" aria-hidden="true" />
          Live from eBay
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
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="group flex flex-col rounded-2xl border border-surface-border bg-surface shadow-card transition-colors hover:border-accent/40"
            >
              <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-t-2xl bg-canvas">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- third-party CDN host isn't known ahead of time, so next/image's allowlist doesn't apply here.
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <Package className="h-10 w-10 text-surface-border" aria-hidden="true" />
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {item.condition}
                </span>
                <h3 className="line-clamp-2 font-heading text-sm font-medium leading-snug text-foreground">
                  {item.title}
                </h3>
                <p className="mt-auto font-mono text-xl font-semibold tabular-nums text-foreground">
                  {formatCurrency(item.price)}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
