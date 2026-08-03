import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  Package,
  ShieldCheck,
  TrendingDown,
  Truck,
  Wallet,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { LiveBuyButton } from "@/components/product/live-buy-button";
import { LivePriceComparison } from "@/components/product/live-price-comparison";
import { OfferComparison } from "@/components/product/offer-comparison";
import { ProductGallery } from "@/components/product/product-gallery";
import { Badge, ConditionBadge } from "@/components/ui/badge";
import { Sparkline } from "@/components/ui/sparkline";
import { Tooltip } from "@/components/ui/tooltip";
import { CATEGORY_LABELS, MOCK_PRODUCTS, productById } from "@/lib/mock-products";
import { offerNetCost } from "@/lib/catalog";
import {
  bestMatchingGroup,
  fetchAllStores,
  groupListings,
  type Product as LiveProduct,
} from "@/lib/marketplace";
import { estimatePriceTrend } from "@/lib/price-trend";
import { normalizeCondition, STORE_INFO } from "@/lib/store-info";
import { formatCurrency, safeDecodeURIComponent } from "@/lib/utils";

/** Generic per-store reference data when a listing's store is somehow outside the known set. */
const FALLBACK_STORE_INFO = {
  color: "#64748b",
  perks: [] as string[],
  warranty: "Check the retailer's page for their current return and warranty policy.",
};

type Params = {
  params: { id: string };
  // Next.js allows any query key to arrive as a string, an array (a repeated
  // key like `?title=a&title=b`), or missing entirely — this type is left
  // loose to match reality rather than assuming a single string always
  // arrives, and `safeDecodeURIComponent` normalizes all three cases.
  searchParams: { title?: string | string[]; store?: string | string[] };
};

/**
 * This route reads `searchParams` (a per-request dynamic API) to resolve
 * live marketplace listings, and `fetchAllStores` below issues its own
 * time-based revalidating fetches. Combined with `generateStaticParams`,
 * that mix of "prerender these params" and "but also read per-request data"
 * is exactly what Next's static/dynamic renderer can't reconcile: any id
 * outside the prerendered mock set hit a framework-level
 * `DYNAMIC_SERVER_USAGE` crash (a 500) the moment it touched `searchParams`
 * — before this file's own try/catch guards ever got a chance to run, since
 * live marketplace listings (i.e. nearly every product a shopper actually
 * clicks) are never in that prerendered set. Forcing the whole route
 * dynamic removes the ambiguity; the mock catalog lookup below is an
 * in-memory array read, so rendering it per-request instead of prebuilding
 * it is not a meaningful performance cost.
 */
export const dynamic = "force-dynamic";

/**
 * The mock catalog is finite and known at build time. Ids outside this set
 * are either a live marketplace listing (resolved at request time from the
 * `title`/`store` query params a listing card links with) or genuinely
 * unknown, in which case the page 404s.
 */
export function generateStaticParams() {
  return MOCK_PRODUCTS.map((p) => ({ id: p.id }));
}

export function generateMetadata({ params, searchParams }: Params): Metadata {
  const id = safeDecodeURIComponent(params.id);
  const product = productById(id);

  if (product) {
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

  const liveTitle = searchParams.title ? safeDecodeURIComponent(searchParams.title).trim() : "";
  if (!liveTitle) return { title: "Product not found" };

  const title = `${liveTitle} — Compare live prices`;
  const description = `Compare live prices for ${liveTitle} across eBay, Amazon, Best Buy, Walmart, and Target, with condition, delivery, and warranty details side by side.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    alternates: { canonical: `/product/${encodeURIComponent(id)}` },
  };
}

export default function ProductPage({ params, searchParams }: Params) {
  const id = safeDecodeURIComponent(params.id);
  const product = productById(id);

  if (product) return <MockProductView product={product} />;

  const liveTitle = searchParams.title ? safeDecodeURIComponent(searchParams.title).trim() : "";
  if (!liveTitle) notFound();

  const preferredStore = searchParams.store
    ? safeDecodeURIComponent(searchParams.store)
    : undefined;

  return <LiveProductView id={id} title={liveTitle} preferredStore={preferredStore} />;
}

/* ------------------------------------------------------------------ */
/* Curated catalog product — unchanged existing behavior               */
/* ------------------------------------------------------------------ */

function MockProductView({ product }: { product: NonNullable<ReturnType<typeof productById>> }) {
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

/* ------------------------------------------------------------------ */
/* Live marketplace listing — eBay / Amazon / Best Buy / Walmart / Target */
/* ------------------------------------------------------------------ */

async function LiveProductView({
  id,
  title,
  preferredStore,
}: {
  id: string;
  title: string;
  preferredStore?: string;
}) {
  // 40 (not the smaller default) so the aggregator's internal shuffle-and-slice
  // never randomly drops an entire store's results before they reach
  // grouping — every store that answered should get a chance at a row.
  const { items } = await fetchAllStores(title, 40).catch(
    () => ({ items: [] as LiveProduct[], errors: [] }),
  );

  // No listings at all is an expected outcome (a slow/rate-limited store,
  // an obscure query) rather than an error — render the fallback directly
  // instead of a 404, so the shopper keeps the title and a way to retry.
  if (items.length === 0) {
    return <LiveProductFallback title={title} />;
  }

  // Everything below reads fields the RapidAPI feeds don't formally guarantee
  // (a store's shape can drift without notice). Rather than let a malformed
  // listing crash the whole page with a 500, fall back to a minimal view
  // built from the title alone — the one thing guaranteed to have reached
  // this component safely.
  try {
    const groups = groupListings(items);
    const group = bestMatchingGroup(groups, { anchorId: id, title });
    const offers = group?.deals ?? [];
    if (offers.length === 0) {
      return <LiveProductFallback title={title} />;
    }

    const anchor =
      offers.find((offer) => offer.id === id) ??
      offers.find((offer) => offer.store === preferredStore) ??
      offers[0];

    if (!anchor) {
      return <LiveProductFallback title={title} />;
    }

    const trend = estimatePriceTrend(anchor, offers);
    const condition = normalizeCondition(anchor.condition ?? null);
    const { perks, warranty } = STORE_INFO[anchor.store] ?? FALLBACK_STORE_INFO;

    const savings = anchor.originalPrice ? anchor.originalPrice - anchor.price : 0;
    const savingsPct =
      anchor.originalPrice && anchor.originalPrice > 0
        ? Math.round((savings / anchor.originalPrice) * 100)
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
                  href={`/search?q=${encodeURIComponent(title)}`}
                  className="rounded-sm transition-colors hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Search results
                </Link>
              </li>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <li aria-current="page" className="line-clamp-1 text-muted">
                {title}
              </li>
            </ol>
          </nav>

          {/* Header ------------------------------------------------- */}
          <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-surface-border bg-canvas">
              {anchor.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- third-party CDN host isn't known ahead of time, so next/image's allowlist doesn't apply here.
                <img
                  src={anchor.image}
                  alt={title}
                  className="h-full w-full object-contain p-6"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-surface to-canvas">
                  <Package className="h-14 w-14 text-surface-border" aria-hidden="true" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Photo unavailable
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={condition.tone} size="md">
                    {condition.label}
                  </Badge>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Best price at {anchor.store}
                  </span>
                </div>
                <h1 className="text-balance font-heading text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
                  {title}
                </h1>
              </div>

              {/* Price summary -------------------------------------- */}
              <div className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded-2xl border border-surface-border bg-surface shadow-card p-5">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-accent-strong">
                    Live price at {anchor.store}
                  </p>
                  <p className="font-mono text-3xl font-semibold tabular-nums leading-tight text-foreground sm:text-4xl">
                    {formatCurrency(anchor.price)}
                  </p>
                </div>

                {anchor.originalPrice && anchor.originalPrice > anchor.price && (
                  <Tooltip content="The retailer's own list price for this listing, shown for reference.">
                    <span className="flex cursor-help flex-col">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        List price
                      </span>
                      <span className="font-mono text-xl tabular-nums text-muted-foreground line-through decoration-muted-foreground/60">
                        {formatCurrency(anchor.originalPrice)}
                      </span>
                    </span>
                  </Tooltip>
                )}
              </div>

              {savingsPct > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-vip/10 px-3.5 py-2.5 ring-1 ring-inset ring-vip/25">
                  <TrendingDown className="h-4 w-4 shrink-0 text-vip-strong" aria-hidden="true" />
                  <p className="font-mono text-sm font-semibold tabular-nums text-vip-strong">
                    Save {savingsPct}%{" "}
                    <span className="text-vip-strong/70">/</span>{" "}
                    {formatCurrency(savings)}
                  </p>
                </div>
              )}

              {/* Price trend ------------------------------------------ */}
              <div className="rounded-2xl border border-surface-border bg-canvas p-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Price Trend
                </span>
                {trend ? (
                  <>
                    <Sparkline
                      data={trend.series}
                      tone={trend.tone}
                      className="mt-2 h-14"
                      ariaLabel={trend.label}
                    />
                    <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                      {trend.label}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Not enough pricing history yet — check back after we&apos;ve
                    tracked this item over a few visits.
                  </p>
                )}
              </div>

              {/* Delivery, perks & warranty for the anchor store ------ */}
              <div className="rounded-2xl border border-surface-border bg-surface shadow-card p-5">
                <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Delivery &amp; Warranty — {anchor.store}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {perks.map((perk) => (
                    <Badge
                      key={perk}
                      tone="slate"
                      size="sm"
                      icon={<Truck className="h-3 w-3" aria-hidden="true" />}
                    >
                      {perk}
                    </Badge>
                  ))}
                </div>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-vip-strong" aria-hidden="true" />
                  {warranty}
                </p>
              </div>

              <LiveBuyButton productId={id} offer={anchor} offerCount={offers.length} />
            </div>
          </section>

          {/* Offers --------------------------------------------------- */}
          <div id="offers" className="scroll-mt-24 pt-12 sm:pt-16">
            <LivePriceComparison productId={id} title={title} offers={offers} />
          </div>
        </div>
      </main>
    </>
    );
  } catch (error) {
    console.error(`Failed to render live comparison for "${title}":`, error);
    return <LiveProductFallback title={title} />;
  }
}

/**
 * Shown when the live feed returned listings but something about them
 * couldn't be safely turned into a comparison (an unexpected store shape, a
 * missing price, etc.) — rather than a 500, the shopper still sees the
 * product they searched for and a way back into search.
 */
function LiveProductFallback({ title }: { title: string }) {
  return (
    <>
      <Navbar />
      <main className="min-h-dvh bg-canvas">
        <div className="px-gutter mx-auto flex max-w-2xl flex-col items-center gap-5 py-24 text-center sm:py-32">
          <Package className="h-12 w-12 text-surface-border" aria-hidden="true" />
          <h1 className="text-balance font-heading text-2xl font-bold sm:text-3xl">
            {title}
          </h1>
          <p className="text-balance text-sm text-muted">
            Live price comparison for this item is temporarily unavailable —
            retailer data didn&apos;t come back in a shape we could compare.
            Try again in a moment, or search for it again.
          </p>
          <Link
            href={`/search?q=${encodeURIComponent(title)}`}
            className="mt-2 rounded-sm text-sm font-medium text-accent-strong underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Search for &quot;{title}&quot; again
          </Link>
        </div>
      </main>
    </>
  );
}
