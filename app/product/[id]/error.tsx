"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCcw, TriangleAlert } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { buttonStyles } from "@/components/ui/button-styles";

/**
 * Route-level error boundary — the last line of defense for this page.
 * Anything that slips past the try/catch in `LiveProductView` (or a bug in
 * the curated-catalog path) lands here instead of Next's generic 500 page,
 * so a shopper always sees a way back to the site rather than a blank error.
 */
export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Product comparison page failed to render:", error);
  }, [error]);

  return (
    <>
      <Navbar />
      <main className="min-h-dvh bg-canvas">
        <div className="px-gutter mx-auto flex max-w-2xl flex-col items-center gap-5 py-24 text-center sm:py-32">
          <TriangleAlert className="h-12 w-12 text-surface-border" aria-hidden="true" />
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">
            Price comparison hit a snag
          </h1>
          <p className="text-balance text-sm text-muted">
            We couldn&apos;t load this comparison just now. It&apos;s usually a
            momentary hiccup with a retailer feed — try again, or head back to
            today&apos;s deals.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className={buttonStyles({ className: "gap-1.5" })}
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
            <Link href="/#deals" className={buttonStyles({ variant: "secondary" })}>
              Browse open-box deals
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
