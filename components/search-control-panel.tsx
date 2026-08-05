"use client";

import { MapPin, Package, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConditionOption =
  | "all"
  | "brand-new"
  | "refurbished"
  | "open-box-pre-owned";

export type FulfillmentOption = "all" | "direct-shipping" | "in-store-pickup";

export type SearchFilters = {
  condition: ConditionOption;
  fulfillment: FulfillmentOption;
  zip: string;
};

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  condition: "all",
  fulfillment: "all",
  zip: "",
};

const CONDITION_OPTIONS: { value: ConditionOption; label: string }[] = [
  { value: "all", label: "All Conditions" },
  { value: "brand-new", label: "Brand New" },
  { value: "refurbished", label: "Refurbished" },
  { value: "open-box-pre-owned", label: "Open Box / Pre-owned" },
];

const FULFILLMENT_OPTIONS: { value: FulfillmentOption; label: string }[] = [
  { value: "all", label: "All Fulfillment" },
  { value: "direct-shipping", label: "Direct Shipping" },
  { value: "in-store-pickup", label: "In-Store Pickup" },
];

const selectClasses =
  "h-11 w-full appearance-none rounded-xl border border-surface-border bg-canvas pl-9 pr-8 text-sm text-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/40";

/**
 * Condition / fulfillment / zip controls for narrowing search results.
 * Purely controlled — the caller (SearchExperience) owns state and decides
 * what each combination actually fetches, since "Brand New" pulls from a
 * different data source than the rest (see components/search-results.tsx).
 */
export function SearchControlPanel({
  value,
  onChange,
  className,
}: {
  value: SearchFilters;
  onChange: (next: SearchFilters) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,9rem)]",
        className,
      )}
    >
      <label className="relative">
        <span className="sr-only">Condition</span>
        <Package
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <select
          value={value.condition}
          onChange={(e) =>
            onChange({ ...value, condition: e.target.value as ConditionOption })
          }
          className={selectClasses}
        >
          {CONDITION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="relative">
        <span className="sr-only">Fulfillment</span>
        <Truck
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <select
          value={value.fulfillment}
          onChange={(e) =>
            onChange({ ...value, fulfillment: e.target.value as FulfillmentOption })
          }
          className={selectClasses}
        >
          {FULFILLMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="relative">
        <span className="sr-only">Zip code</span>
        <MapPin
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          placeholder="Zip code"
          value={value.zip}
          onChange={(e) =>
            onChange({ ...value, zip: e.target.value.replace(/[^0-9]/g, "").slice(0, 5) })
          }
          className="h-11 w-full rounded-xl border border-surface-border bg-canvas pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
      </label>
    </div>
  );
}
