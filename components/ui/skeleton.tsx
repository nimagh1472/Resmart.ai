import { cn } from "@/lib/utils";

/**
 * A single shimmering placeholder block. The sweep is a child element rather
 * than a background-position animation so it stays smooth on low-end mobile.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-md bg-surface-raised",
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}

/** Placeholder matching a single product card in the search results grid. */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface p-3",
        className,
      )}
    >
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="flex flex-col gap-2 px-1 pb-1">
        <Skeleton className="h-5 w-20 rounded-full" /> {/* condition badge */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/5" />
        <div className="mt-1 flex items-center justify-between">
          <Skeleton className="h-6 w-24" /> {/* price */}
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
}

/**
 * Full grid placeholder for search fetches. Mirrors the live grid's columns so
 * results don't reflow when they land.
 */
export function ProductGridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading products"
      className={cn(
        // Mirrors ProductGrid exactly so results don't reflow on load.
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading products…</span>
    </div>
  );
}

/** Placeholder for a stacked list of text lines. */
export function TextSkeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
