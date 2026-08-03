"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BellOff, BellRing, ExternalLink, Trash2 } from "lucide-react";
import { ConditionBadge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sparkline } from "@/components/ui/sparkline";
import { RETAILERS } from "@/components/ProductCard";
import { formatDate, productById, type SavedDeal } from "@/lib/mock-account";
import { cn, formatCurrency } from "@/lib/utils";

export function SavedDealsTab({
  deals,
  onUpdate,
  onRemove,
}: {
  deals: SavedDeal[];
  onUpdate: (productId: string, patch: Partial<SavedDeal>) => void;
  onRemove: (productId: string) => void;
}) {
  if (deals.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-surface-border py-16 text-center text-sm text-muted-foreground">
        No saved deals yet. Bookmark a listing to track its price.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {deals.map((deal) => {
          const product = productById(deal.productId);
          if (!product) return null;

          const hit = product.price <= deal.targetPrice;
          const gap = product.price - deal.targetPrice;
          const alertsOn = deal.sms || deal.email;

          return (
            <motion.li
              key={deal.productId}
              layout
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.22 }}
              className={cn(
                "overflow-hidden rounded-2xl border bg-surface",
                hit ? "border-vip/40 shadow-glow-vip" : "border-surface-border",
              )}
            >
              <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                {/* Product ------------------------------------------ */}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-md border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                      style={{
                        color: RETAILERS[product.retailer].color,
                        borderColor: `${RETAILERS[product.retailer].color}40`,
                        backgroundColor: `${RETAILERS[product.retailer].color}14`,
                      }}
                    >
                      {RETAILERS[product.retailer].label}
                    </span>
                    <ConditionBadge condition={product.condition} size="sm" />
                  </div>

                  <h3 className="font-heading text-sm font-medium leading-snug">
                    <span className="text-muted">{product.brand}</span>{" "}
                    {product.model}
                  </h3>

                  <p className="text-[11px] text-muted-foreground">
                    Saved {formatDate(deal.savedOn)}
                  </p>
                </div>

                {/* Price + trend ------------------------------------ */}
                <div className="flex items-center gap-4 lg:w-64">
                  <div className="shrink-0">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Current
                    </p>
                    <p className="font-mono text-lg font-semibold tabular-nums">
                      {formatCurrency(product.price)}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Sparkline data={product.priceHistory} />
                  </div>
                </div>

                {/* Target + alerts ---------------------------------- */}
                <div className="flex flex-col gap-2.5 lg:w-64">
                  <label className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Target price
                    </span>
                    <span className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                        $
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={deal.targetPrice}
                        onChange={(e) =>
                          onUpdate(deal.productId, {
                            targetPrice: Math.max(0, Number(e.target.value)),
                          })
                        }
                        aria-label={`Target price for ${product.brand} ${product.model}`}
                        className="h-8 w-24 rounded-lg border border-surface-border bg-canvas pl-5 pr-2 font-mono text-xs tabular-nums text-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/40"
                      />
                    </span>
                  </label>

                  <p
                    className={cn(
                      "text-[11px]",
                      hit ? "text-vip-strong" : "text-muted-foreground",
                    )}
                  >
                    {hit
                      ? "Target met — this deal is at or below your price."
                      : `${formatCurrency(gap)} above your target.`}
                  </p>

                  <div className="flex items-center gap-4">
                    <Switch
                      checked={deal.sms}
                      onCheckedChange={(sms) =>
                        onUpdate(deal.productId, { sms })
                      }
                      label="SMS"
                      showLabel
                      size="sm"
                    />
                    <Switch
                      checked={deal.email}
                      onCheckedChange={(email) =>
                        onUpdate(deal.productId, { email })
                      }
                      label="Email"
                      showLabel
                      size="sm"
                      tone="accent"
                    />
                  </div>
                </div>

                {/* Actions ------------------------------------------ */}
                <div className="flex items-center gap-1 lg:flex-col">
                  <span
                    title={
                      alertsOn ? "Alerts active" : "No alert channels enabled"
                    }
                    className={cn(
                      "rounded-lg p-2",
                      alertsOn ? "text-vip-strong" : "text-muted-foreground",
                    )}
                  >
                    {alertsOn ? (
                      <BellRing className="h-4 w-4" />
                    ) : (
                      <BellOff className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {alertsOn ? "Alerts active" : "Alerts off"}
                    </span>
                  </span>

                  <a
                    href={product.dealUrl}
                    target="_blank"
                    rel="nofollow sponsored noopener noreferrer"
                    aria-label={`View ${product.brand} ${product.model} deal`}
                    className="rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-accent-strong"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>

                  <button
                    type="button"
                    onClick={() => onRemove(deal.productId)}
                    aria-label={`Remove ${product.brand} ${product.model} from saved deals`}
                    className="rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
