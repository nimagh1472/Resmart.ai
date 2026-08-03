import { Package } from "lucide-react";
import type { EbayListing } from "@/lib/ebay";
import { formatCurrency } from "@/lib/utils";

/** A single live listing card — shared by the homepage feed and search results. */
export function ListingCard({ item }: { item: EbayListing }) {
  return (
    <a
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
  );
}
