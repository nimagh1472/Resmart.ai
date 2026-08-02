import Link from "next/link";
import { PackageX } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { buttonStyles } from "@/components/ui/button-styles";

/** Rendered when the route's id doesn't match anything in the catalog. */
export default function ProductNotFound() {
  return (
    <>
      <Navbar />
      <main className="min-h-dvh bg-canvas">
        <div className="px-gutter mx-auto flex max-w-2xl flex-col items-center gap-5 py-24 text-center sm:py-32">
          <PackageX className="h-12 w-12 text-surface-border" aria-hidden="true" />
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">
            We couldn&apos;t find that product
          </h1>
          <p className="text-balance text-sm text-muted">
            The listing may have sold out or been delisted by every merchant
            carrying it. Today&apos;s live open-box deals are on the home page.
          </p>
          <Link href="/#deals" className={buttonStyles({ className: "mt-2" })}>
            Browse open-box deals
          </Link>
        </div>
      </main>
    </>
  );
}
