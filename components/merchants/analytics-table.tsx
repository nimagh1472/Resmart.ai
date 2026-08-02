"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ExternalLink,
  Lock,
  Package,
  Pencil,
  Trash2,
} from "lucide-react";
import { Badge, ConditionBadge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  COMMISSION_RATE,
  adSpend,
  commission,
  ctr,
  revenue,
  type MerchantListing,
} from "@/lib/mock-merchant";
import { cn, formatCurrency } from "@/lib/utils";

type SortKey =
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpcBid"
  | "adSpend"
  | "unitsSold"
  | "revenue"
  | "commission";

const COLUMNS: { key: SortKey; label: string; group: "ads" | "sales" }[] = [
  { key: "impressions", label: "Impr.", group: "ads" },
  { key: "clicks", label: "Clicks", group: "ads" },
  { key: "ctr", label: "CTR", group: "ads" },
  { key: "cpcBid", label: "CPC Bid", group: "ads" },
  { key: "adSpend", label: "Ad Spend", group: "ads" },
  { key: "unitsSold", label: "Sold", group: "sales" },
  { key: "revenue", label: "Revenue", group: "sales" },
  { key: "commission", label: "Commission", group: "sales" },
];

function metric(l: MerchantListing, key: SortKey): number {
  switch (key) {
    case "ctr":
      return ctr(l);
    case "adSpend":
      return adSpend(l);
    case "revenue":
      return revenue(l);
    case "commission":
      return commission(l);
    default:
      return l[key];
  }
}

const num = (n: number) => n.toLocaleString("en-US");
const percent = (n: number) => `${(n * 100).toFixed(2)}%`;

export function AnalyticsTable({
  listings,
  canBoost,
  onToggleBoost,
  onEdit,
  onDelete,
  className,
}: {
  listings: MerchantListing[];
  /** False while unapproved — boost toggles render locked. */
  canBoost: boolean;
  onToggleBoost: (id: string, enabled: boolean) => void;
  onEdit: (listing: MerchantListing) => void;
  onDelete: (listing: MerchantListing) => void;
  className?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [desc, setDesc] = useState(true);

  const sorted = useMemo(
    () =>
      [...listings].sort((a, b) => {
        const diff = metric(a, sortKey) - metric(b, sortKey);
        return desc ? -diff : diff;
      }),
    [listings, sortKey, desc],
  );

  const totals = useMemo(
    () =>
      listings.reduce(
        (acc, l) => ({
          impressions: acc.impressions + l.impressions,
          clicks: acc.clicks + l.clicks,
          adSpend: acc.adSpend + adSpend(l),
          unitsSold: acc.unitsSold + l.unitsSold,
          revenue: acc.revenue + revenue(l),
          commission: acc.commission + commission(l),
        }),
        {
          impressions: 0,
          clicks: 0,
          adSpend: 0,
          unitsSold: 0,
          revenue: 0,
          commission: 0,
        },
      ),
    [listings],
  );

  const blendedCtr =
    totals.impressions === 0 ? 0 : totals.clicks / totals.impressions;

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  };

  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border border-surface-border bg-surface",
        className,
      )}
      aria-labelledby="analytics-heading"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-border p-5">
        <span className="rounded-lg bg-accent/10 p-2 ring-1 ring-inset ring-accent/20">
          <BarChart3 className="h-4 w-4 text-accent" aria-hidden="true" />
        </span>
        <h2
          id="analytics-heading"
          className="font-heading text-sm font-semibold"
        >
          Inventory &amp; Performance
        </h2>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {listings.length} listing{listings.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Below lg the table becomes a card list — an 11-column grid can't be
          made readable in 390px, and horizontal scroll hides the actions. */}
      <ul className="flex flex-col divide-y divide-surface-border/60 lg:hidden">
        {sorted.map((l) => {
          const boosted = l.boostEnabled && canBoost;
          return (
            <li
              key={l.id}
              className={cn("flex flex-col gap-3 p-4", !boosted && "opacity-70")}
            >
              <div className="flex items-start gap-3">
                <Thumb src={l.imageUrl} alt={l.title} className="h-14 w-14" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1.5 font-medium text-foreground"
                  >
                    <span className="min-w-0 break-words">{l.title}</span>
                    <ExternalLink
                      className="mt-1 h-3 w-3 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </a>
                  <div className="flex flex-wrap items-center gap-2">
                    <ConditionBadge condition={l.condition} size="sm" />
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatCurrency(l.price)}
                      <span className="ml-1 line-through opacity-60">
                        {formatCurrency(l.msrp)}
                      </span>
                    </span>
                    {l.stock === 0 ? (
                      <Badge tone="rose" size="sm">
                        Out of stock
                      </Badge>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {l.stock} in stock
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-x-3 gap-y-2 rounded-xl border border-surface-border bg-canvas/40 p-3">
                <Stat label="Impr." value={num(l.impressions)} />
                <Stat label="Clicks" value={num(l.clicks)} />
                <Stat label="CTR" value={percent(ctr(l))} tone="accent" />
                <Stat label="Bid" value={formatCurrency(l.cpcBid, { cents: true })} />
                <Stat
                  label="Ad spend"
                  value={formatCurrency(adSpend(l), { cents: true })}
                />
                <Stat label="Sold" value={num(l.unitsSold)} />
                <Stat
                  label="Revenue"
                  value={formatCurrency(revenue(l), { cents: true })}
                  tone="vip"
                />
                <Stat
                  label="Commission"
                  value={`−${formatCurrency(commission(l), { cents: true })}`}
                  tone="amber"
                />
              </dl>

              <div className="flex items-center justify-between gap-3">
                {canBoost ? (
                  <Switch
                    checked={l.boostEnabled}
                    onCheckedChange={(v) => onToggleBoost(l.id, v)}
                    label="CPC boost"
                    showLabel
                    size="sm"
                    tone="accent"
                  />
                ) : (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-amber-300/70">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    Boost locked
                  </span>
                )}

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(l)}
                    aria-label={`Edit ${l.title}`}
                    className="touch-target rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-accent"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(l)}
                    aria-label={`Delete ${l.title}`}
                    className="touch-target rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}

        {listings.length === 0 && (
          <li className="px-5 py-12 text-center text-sm text-muted-foreground">
            No listings yet. Add inventory to start selling.
          </li>
        )}
      </ul>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[78rem] border-collapse text-sm">
          <caption className="sr-only">
            Listing inventory, ad performance, and sales, sortable by column
          </caption>
          <thead>
            <tr className="border-b border-surface-border">
              <th
                scope="col"
                className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Listing
              </th>
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      active ? (desc ? "descending" : "ascending") : "none"
                    }
                    className={cn(
                      "px-3 py-3 text-right",
                      col.group === "sales" &&
                        col.key === "unitsSold" &&
                        "border-l border-surface-border",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest transition",
                        active
                          ? "text-accent"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {col.label}
                      {active &&
                        (desc ? (
                          <ArrowDown className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ArrowUp className="h-3 w-3" aria-hidden="true" />
                        ))}
                    </button>
                  </th>
                );
              })}
              <th
                scope="col"
                className="border-l border-surface-border px-3 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Boost
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((l) => {
              const boosted = l.boostEnabled && canBoost;
              return (
                <tr
                  key={l.id}
                  className={cn(
                    "border-b border-surface-border/60 transition-colors hover:bg-surface-raised/40",
                    !boosted && "opacity-70",
                  )}
                >
                  <td className="max-w-xs px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Thumb
                        src={l.imageUrl}
                        alt={l.title}
                        className="h-11 w-11"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-1.5 truncate font-medium text-foreground hover:text-accent"
                        >
                          <span className="truncate">{l.title}</span>
                          <ExternalLink
                            className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden="true"
                          />
                        </a>
                        <div className="flex flex-wrap items-center gap-2">
                          <ConditionBadge condition={l.condition} size="sm" />
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatCurrency(l.price)}
                            <span className="ml-1 line-through opacity-60">
                              {formatCurrency(l.msrp)}
                            </span>
                          </span>
                          {l.stock === 0 ? (
                            <Badge tone="rose" size="sm">
                              Out of stock
                            </Badge>
                          ) : (
                            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              {l.stock} in stock
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <Cell>{num(l.impressions)}</Cell>
                  <Cell>{num(l.clicks)}</Cell>
                  <Cell className="text-accent">{percent(ctr(l))}</Cell>
                  <Cell>{formatCurrency(l.cpcBid, { cents: true })}</Cell>
                  <Cell>{formatCurrency(adSpend(l), { cents: true })}</Cell>

                  <Cell className="border-l border-surface-border">
                    {num(l.unitsSold)}
                  </Cell>
                  <Cell className="font-semibold text-vip">
                    {formatCurrency(revenue(l), { cents: true })}
                  </Cell>
                  <Cell className="text-amber-300">
                    −{formatCurrency(commission(l), { cents: true })}
                  </Cell>

                  <td className="border-l border-surface-border px-3 py-3.5 text-right">
                    {canBoost ? (
                      <Switch
                        checked={l.boostEnabled}
                        onCheckedChange={(v) => onToggleBoost(l.id, v)}
                        label={`CPC boost for ${l.title}`}
                        size="sm"
                        tone="accent"
                      />
                    ) : (
                      <span
                        title="Available after admin approval"
                        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-amber-300/70"
                      >
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        Locked
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(l)}
                        aria-label={`Edit ${l.title}`}
                        className="rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(l)}
                        aria-label={`Delete ${l.title}`}
                        className="rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {listings.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length + 3}
                  className="px-5 py-12 text-center text-sm text-muted-foreground"
                >
                  No listings yet. Add inventory to start selling.
                </td>
              </tr>
            )}
          </tbody>

          {listings.length > 0 && (
            <tfoot>
              <tr className="border-t border-surface-border bg-canvas/40">
                <td className="px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Total
                </td>
                <Cell className="font-semibold text-foreground">
                  {num(totals.impressions)}
                </Cell>
                <Cell className="font-semibold text-foreground">
                  {num(totals.clicks)}
                </Cell>
                <Cell className="font-semibold text-accent">
                  {percent(blendedCtr)}
                </Cell>
                <Cell className="text-muted-foreground">—</Cell>
                <Cell className="font-semibold text-foreground">
                  {formatCurrency(totals.adSpend, { cents: true })}
                </Cell>
                <Cell className="border-l border-surface-border font-semibold text-foreground">
                  {num(totals.unitsSold)}
                </Cell>
                <Cell className="font-semibold text-vip">
                  {formatCurrency(totals.revenue, { cents: true })}
                </Cell>
                <Cell className="font-semibold text-amber-300">
                  −{formatCurrency(totals.commission, { cents: true })}
                </Cell>
                <td className="border-l border-surface-border" />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="border-t border-surface-border px-5 py-3 text-[11px] text-muted-foreground">
        Commission is {Math.round(COMMISSION_RATE * 100)}% of completed sales.
        Ad spend is billed per click and is independent of whether a click
        converts.
      </p>
    </section>
  );
}

/**
 * Listing thumbnail. The src is whatever the merchant supplied — a data URL
 * from an upload or a hotlink to any host — so `next/image` is out on both
 * counts, and a dead link falls back to the placeholder rather than a broken
 * frame.
 */
function Thumb({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-surface-border bg-canvas",
        className,
      )}
    >
      {src && !failed ? (
        /* eslint-disable-next-line @next/next/no-img-element -- merchant-supplied data URL or arbitrary host */
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <Package
          className="h-4 w-4 text-surface-border"
          aria-label={`${alt} — no photo`}
        />
      )}
    </div>
  );
}

/** Compact label/value pair used by the sub-`lg` card layout. */
function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "vip" | "amber";
}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "truncate font-mono text-xs font-medium tabular-nums",
          tone === "accent" && "text-accent",
          tone === "vip" && "text-vip",
          tone === "amber" && "text-amber-300",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Cell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-3 py-3.5 text-right font-mono text-sm tabular-nums text-muted",
        className,
      )}
    >
      {children}
    </td>
  );
}
