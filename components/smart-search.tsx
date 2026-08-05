"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  ImageUp,
  Package,
  Search,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, ConditionBadge } from "@/components/ui/badge";
import { productHref, type Product } from "@/components/ProductCard";
import { CATEGORY_LABELS, MOCK_PRODUCTS } from "@/lib/mock-products";
import { RETAILERS } from "@/lib/catalog";
import { searchProducts } from "@/lib/search";
import { buildAiMatchOffers, inferProduct } from "@/lib/product-inference";
import { cn, formatCurrency } from "@/lib/utils";

// Camera/upload UI is only needed once the shopper opens it, so it's split
// out of the homepage's initial bundle.
const VisionAiModal = dynamic(
  () => import("@/components/vision-ai-modal").then((m) => m.VisionAiModal),
  { ssr: false },
);

/**
 * One-click queries under the search bar. `label` is the shopper-facing intent
 * and `query` is what actually gets typed — they differ for the laundry chip
 * because "washer & dryer" as a literal AND query matches neither machine,
 * while the shared "laundry" keyword matches both.
 */
const QUICK_FILTERS: { label: string; query: string }[] = [
  { label: "Xbox Series X", query: "Xbox Series X" },
  { label: "4K OLED TV", query: "4K OLED TV" },
  { label: "MacBook Pro", query: "MacBook Pro" },
  { label: "Dryer / Washer", query: "laundry" },
  { label: "Headphones", query: "headphones" },
];

/** Results shown inline; the rest are reachable from the "see all" row. */
const VISIBLE_RESULTS = 5;

export function SmartSearch({
  className,
  products = MOCK_PRODUCTS,
}: {
  className?: string;
  /** Defaults to the full catalog; injectable for tests and story fixtures. */
  products?: Product[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [visionOpen, setVisionOpen] = useState(false);

  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();

  // 19 listings — filtering on every keystroke is cheaper than a debounce
  // timer, and the results never lag behind the caret.
  const hits = useMemo(
    () => (trimmed ? searchProducts(trimmed, products) : []),
    [trimmed, products],
  );

  const results = hits.slice(0, VISIBLE_RESULTS);

  /**
   * Nothing in stock matched, so project what an open-box listing for this
   * would look like. Derived from the query itself — there is no canned
   * fallback product.
   */
  const aiMatch = useMemo(() => {
    if (!trimmed || hits.length > 0) return null;
    const parsed = inferProduct({ text: trimmed });
    return { parsed, offers: buildAiMatchOffers(parsed) };
  }, [trimmed, hits.length]);

  const showPanel = open && trimmed.length > 0;

  // Clamp the highlight when the result set shrinks under the caret.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, results.length - 1)));
  }, [results.length]);

  // Close on outside click — the panel overlays page content below the hero.
  useEffect(() => {
    if (!showPanel) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showPanel]);

  const runQuery = useCallback((next: string) => {
    setQuery(next);
    setActive(0);
    setOpen(true);
    inputRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a - 1 + results.length) % results.length);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    // Enter/Search always runs a live cross-API search, even when the typeahead
    // panel below is showing a mock-catalog match for the same keystrokes.
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div ref={rootRef} className={cn("flex w-full flex-col gap-4", className)}>
      {/* The results panel anchors to this wrapper, not the whole cluster, so
          it drops directly beneath the input and overlays the chips below. */}
      <div className="relative">
        <form
          onSubmit={submit}
          role="search"
          className="flex flex-col gap-2 rounded-2xl border border-surface-border bg-surface p-2 shadow-card focus-within:border-accent/40 focus-within:shadow-glow sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder="Search any product — we'll find the open-box price"
              aria-label="Search open-box and refurbished inventory"
              role="combobox"
              aria-expanded={showPanel}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                showPanel && results[active]
                  ? `${listboxId}-${results[active].product.id}`
                  : undefined
              }
              className="h-12 w-full bg-transparent pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="grid shrink-0 grid-cols-1 items-center gap-2 sm:flex">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisionOpen(true)}
              leftIcon={<ImageUp className="h-4 w-4" />}
            >
              <span className="hidden sm:inline">
                Upload Screenshot / Paste Link
              </span>
              <span className="sm:hidden">Upload / Paste</span>
            </Button>
            <Button type="submit" className="shrink-0">
              Search
            </Button>
          </div>
        </form>

        {/* Live results -------------------------------------------------- */}
        {showPanel && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-surface-border bg-surface text-left shadow-card">
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {hits.length > 0
                  ? `${hits.length} match${hits.length === 1 ? "" : "es"} in stock`
                  : "No exact match in stock"}
              </span>
              {hits.length > results.length && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  showing {results.length}
                </span>
              )}
            </div>

            {hits.length > 0 ? (
              <ul id={listboxId} role="listbox" aria-label="Search results">
                {results.map((hit, i) => (
                  <ResultRow
                    key={hit.product.id}
                    id={`${listboxId}-${hit.product.id}`}
                    product={hit.product}
                    matchedFields={hit.matchedFields}
                    active={i === active}
                    onHover={() => setActive(i)}
                    onSelect={() => setOpen(false)}
                  />
                ))}
              </ul>
            ) : (
              aiMatch && (
                <AiMatchCard
                  query={trimmed}
                  parsed={aiMatch.parsed}
                  offers={aiMatch.offers}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Quick filters ------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Try
        </span>
        {QUICK_FILTERS.map((chip) => {
          const selected = query === chip.query;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => runQuery(chip.query)}
              aria-pressed={selected}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                selected
                  ? "border-accent/50 bg-accent/10 text-accent-strong"
                  : "border-surface-border bg-surface text-muted hover:border-accent/40 hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <VisionAiModal
        open={visionOpen}
        onClose={() => setVisionOpen(false)}
        initialQuery={trimmed}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ResultRow({
  id,
  product,
  matchedFields,
  active,
  onHover,
  onSelect,
}: {
  id: string;
  product: Product;
  matchedFields: string[];
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const savings = product.msrp - product.price;
  const savingsPct = Math.round((savings / product.msrp) * 100);

  return (
    <li id={id} role="option" aria-selected={active}>
      <Link
        href={productHref(product.id)}
        onMouseEnter={onHover}
        onClick={onSelect}
        className={cn(
          "flex items-center gap-3 border-b border-surface-border/60 px-4 py-3 transition last:border-b-0",
          active ? "bg-accent/[0.06]" : "hover:bg-canvas",
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-canvas">
          <Package
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium">
            <span className="text-muted">{product.brand}</span> {product.model}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span>{CATEGORY_LABELS[product.category]}</span>
            <span aria-hidden="true">·</span>
            <span>{RETAILERS[product.retailer].label}</span>
            {matchedFields.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-accent-strong">
                  matched {matchedFields.slice(0, 2).join(" + ").toLowerCase()}
                </span>
              </>
            )}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-sm font-semibold tabular-nums">
            {formatCurrency(product.price)}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-vip-strong">
            −{savingsPct}%
          </span>
        </span>
      </Link>
    </li>
  );
}

function AiMatchCard({
  query,
  parsed,
  offers,
}: {
  query: string;
  parsed: ReturnType<typeof inferProduct>;
  offers: ReturnType<typeof buildAiMatchOffers>;
}) {
  const best = offers[0];

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3 rounded-xl border border-vip/25 bg-vip/[0.06] p-3">
        <Sparkles
          className="mt-0.5 h-4 w-4 shrink-0 text-vip-strong"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">
            AI Match ·{" "}
            <span className="text-vip-strong">{parsed.productName}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            We don&apos;t stock &ldquo;{query}&rdquo; yet. Based on{" "}
            {parsed.categoryLabel.toLowerCase()} pricing, here&apos;s the
            open-box deal our sourcing agents would target — estimated retail{" "}
            <span className="font-mono text-foreground">
              {formatCurrency(parsed.estimatedMsrp)}
            </span>
            {parsed.msrpSource === "estimated" && " (estimated)"}.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {parsed.brand && (
          <Badge tone="sky" size="sm">
            {parsed.brand}
          </Badge>
        )}
        <Badge tone="slate" size="sm">
          {parsed.categoryLabel}
        </Badge>
        <Badge tone="slate" size="sm">
          {parsed.confidence} confidence
        </Badge>
      </div>

      <ul className="flex flex-col gap-1.5">
        {offers.map((offer, i) => (
          <li
            key={offer.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border bg-canvas px-3 py-2",
              i === 0 ? "border-accent/40" : "border-surface-border",
            )}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-xs font-medium">
                {offer.merchantLabel}
                {offer.shipping > 0 && (
                  <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                    +{formatCurrency(offer.shipping)} ship
                  </span>
                )}
              </span>
              <ConditionBadge condition={offer.condition} size="sm" />
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="font-mono text-sm font-semibold tabular-nums">
                {formatCurrency(offer.price)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <TrendingDown
          className="h-3.5 w-3.5 shrink-0 text-vip-strong"
          aria-hidden="true"
        />
        <p>
          Projected — not live inventory. Best target saves about{" "}
          <span className="font-mono text-vip-strong">
            {formatCurrency(parsed.estimatedMsrp - best.price)}
          </span>{" "}
          off retail.
        </p>
      </div>

      <Link
        href="#deals"
        className="flex items-center justify-center gap-1.5 rounded-xl border border-surface-border px-3 py-2 text-xs text-muted transition hover:border-accent/40 hover:text-foreground"
      >
        Browse what&apos;s in stock now
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
