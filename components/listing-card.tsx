import { Package } from "lucide-react";
import type { Product } from "@/lib/marketplace";
import { formatCurrency } from "@/lib/utils";

const STORE_BADGE_CLASSES: Record<Product["store"], string> = {
  eBay: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Amazon: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  "Best Buy": "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  Walmart: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

/** A single live listing card — shared by the homepage feed and search results. */
export function ListingCard({ item }: { item: Product }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="group flex flex-col rounded-2xl border border-surface-border bg-surface shadow-card transition-colors hover:border-accent/40"
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-t-2xl bg-canvas">
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${STORE_BADGE_CLASSES[item.store]}`}
        >
          {item.store}
        </span>
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
          {item.condition ?? "Not specified"}
        </span>
        <h3 className="line-clamp-2 font-heading text-sm font-medium leading-snug text-foreground">
          {item.title}
        </h3>
        <div className="mt-auto flex items-baseline gap-2">
          <p className="font-mono text-xl font-semibold tabular-nums text-foreground">
            {formatCurrency(item.price)}
          </p>
          {item.originalPrice ? (
            <p className="font-mono text-sm tabular-nums text-muted-foreground line-through">
              {formatCurrency(item.originalPrice)}
            </p>
          ) : null}
        </div>
      </div>
    </a>
  );
}
