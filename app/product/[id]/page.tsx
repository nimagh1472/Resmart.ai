import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, TrendingDown, Wallet } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { OfferComparison } from "@/components/product/offer-comparison";
import { ProductGallery } from "@/components/product/product-gallery";
import { ConditionBadge } from "@/components/ui/badge";
import { Sparkline } from "@/components/ui/sparkline";
import { Tooltip } from "@/components/ui/tooltip";
import { CATEGORY_LABELS, MOCK_PRODUCTS, productById } from "@/lib/mock-products";
import { offerNetCost } from "@/lib/catalog";
import { formatCurrency } from "@/lib/utils";

type Params = { params: { id: string } };

/**
 * The mock catalog is finite and known at build time, so every product page is
 * prerendered. Ids outside this set still resolve — `productById` returns
 * undefined and the page 404s — rather than rendering a shell for something
 * that doesn't exist.
 */
export function generateStaticParams() {
  return MOCK_PRODUCTS.map((p) => ({ id: p.id }));
}

export function generateMetadata({ params }: Params): Metadata {
  const product = productById(params.id);

  if (!product) {
    return { title: "Product not found" };
  }

  const title = `${product.brand} ${product.model}`;
  const description = `Compare ${product.offers.length} open-box and refurbished offers for the ${title}, from ${formatCurrency(product.price)}. Warranty, shipping and VIP cashback side by side.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    // Affiliate comparison pages shouldn't compete with the merchant listings
    // they point at; index the page but let the outbound links stay nofollow.
    alternates: { canonical: `/product/${encodeURIComponent(product.id)}` },
  };
}

export default function ProductPage({ params }: Params) {
  const product = productById(params.id);

  if (!product) notFound();

  const {
    id,
    brand,
    model,
    category,
    image,
    gallery,
    specs,
    condition,
    msrp,
    price,
    cashback,
    priceHistory,
    offers,
  } = product;

  const title = `${brand} ${model}`;
  // `gallery` is the full set when supplied; otherwise fall back to the single
  // card image, and to the placeholder frame when there's nothing at all.
  const images = gallery?.length ? gallery : image ? [image] : [];

  const savings = msrp - price;
  const savingsPct = msrp > 0 ? Math.round((savings / msrp) * 100) : 0;
  const bestNet = offers.length > 0 ? offerNetCost(offers[0]) : price;
  const ninetyDayDelta =
    priceHistory.length > 1
      ? priceHistory[priceHistory.length - 1] - priceHistory[0]
      : 0;

  return (
    <>
      <Navbar />
      <main className="min-h-dvh bg-canvas">
        <div className="px-gutter mx-auto max-w-7xl py-8 sm:py-12">
          {/* Breadcrumb --------------------------------------------- */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <li>
                <Link
                  href="/"
                  className="rounded-sm transition-colors hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Home
                </Link>
              </li>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <li>
                <Link
                  href="/#deals"
                  className="rounded-sm transition-colors hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {CATEGORY_LABELS[category]}
                </Link>
              </li>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <li aria-current="page" className="text-muted">
                {model}
              </li>
            </ol>
          </nav>

          {/* Header ------------------------------------------------- */}
          <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
            <ProductGallery images={images} alt={title} />

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <ConditionBadge condition={condition} size="md" />
                <h1 className="text-balance font-heading text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
                  <span className="text-muted">{brand}</span>{" "}
                  <span className="text-foreground">{model}</span>
                </h1>
              </div>

              {/* Price summary -------------------------------------- */}
              <div className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded-2xl border border-surface-border bg-surface shadow-card p-5">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-accent-strong">
                    Best open-box price
                  </p>
                  <p className="font-mono text-3xl font-semibold tabular-nums leading-tight text-foreground sm:text-4xl">
                    {formatCurrency(price)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {formatCurrency(bestNet, { cents: true })} total after
                    shipping &amp; cashback
                  </p>
                </div>

                <Tooltip content="Manufacturer's suggested retail price. Shown for reference only — it is not a recent selling price.">
                  <span className="flex cursor-help flex-col">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Retail MSRP
                    </span>
                    <span className="font-mono text-xl tabular-nums text-muted-foreground line-through decoration-muted-foreground/60">
                      {formatCurrency(msrp)}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                      Reference only
                    </span>
                  </span>
                </Tooltip>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-xl bg-vip/10 px-3.5 py-2.5 ring-1 ring-inset ring-vip/25">
                  <TrendingDown
                    className="h-4 w-4 shrink-0 text-vip-strong"
                    aria-hidden="true"
                  />
                  <p className="font-mono text-sm font-semibold tabular-nums text-vip-strong">
                    Save {savingsPct}%{" "}
                    <span className="text-vip-strong/70">/</span>{" "}
                    {formatCurrency(savings)}
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-vip/25 bg-vip/[0.06] px-3.5 py-2.5">
                  <Wallet
                    className="h-4 w-4 shrink-0 text-vip-strong"
                    aria-hidden="true"
                  />
                  <p className="text-xs leading-snug text-muted">
                    +{" "}
                    <span className="font-mono font-semibold tabular-nums text-vip-strong">
                      {formatCurrency(cashback, { cents: true })}
                    </span>{" "}
                    Cashback for{" "}
                    <span className="font-medium text-vip-strong">VIP Members</span>
                  </p>
                </div>
              </div>

              {/* 90-day trend --------------------------------------- */}
              <div className="rounded-2xl border border-surface-border bg-canvas p-4">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    90-Day Price Trend
                  </span>
                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      ninetyDayDelta < 0 ? "text-vip-strong" : "text-muted-foreground"
                    }`}
                  >
                    {ninetyDayDelta < 0 ? "▼" : ninetyDayDelta > 0 ? "▲" : "—"}{" "}
                    {formatCurrency(Math.abs(ninetyDayDelta))}
                  </span>
                </div>
                <Sparkline
                  data={priceHistory}
                  className="h-14"
                  ariaLabel={`90-day price trend for ${title}, ${
                    ninetyDayDelta < 0 ? "down" : "up"
                  } ${formatCurrency(Math.abs(ninetyDayDelta))}`}
                />
              </div>

              {/* Specs ---------------------------------------------- */}
              {specs && specs.length > 0 && (
                <div className="rounded-2xl border border-surface-border bg-surface shadow-card p-5">
                  <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Specifications
                  </h2>
                  <dl className="divide-y divide-surface-border/70">
                    {specs.map((spec) => (
                      <div
                        key={spec.label}
                        className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2 first:pt-0 last:pb-0"
                      >
                        <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                          {spec.label}
                        </dt>
                        <dd className="text-right text-sm text-foreground">
                          {spec.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </section>

          {/* Offers --------------------------------------------------- */}
          <div id="offers" className="scroll-mt-24 pt-12 sm:pt-16">
            <OfferComparison
              productId={id}
              title={title}
              msrp={msrp}
              offers={offers}
            />
          </div>
        </div>
      </main>
    </>
  );
}
