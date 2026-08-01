"use client";

import { useState } from "react";
import { Lock, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CONDITIONS } from "@/components/ui/badge";
import type { CardCondition } from "@/lib/catalog";
import {
  COMMISSION_RATE,
  CPC_MAX,
  CPC_MIN,
  CPC_STEP,
  forecastForBid,
  netPerUnit,
  type MerchantListing,
} from "@/lib/mock-merchant";
import { cn, formatCurrency } from "@/lib/utils";

/** The two grades ReSmart surfaces, labelled as merchants refer to them. */
const CONDITION_OPTIONS: { value: CardCondition; label: string }[] = [
  { value: "open-box-excellent", label: "Open-Box" },
  { value: "certified-refurbished", label: "Refurbished" },
];

/** Everything a merchant supplies; ids and metrics are assigned by the server. */
export type ListingDraft = Pick<
  MerchantListing,
  "title" | "condition" | "msrp" | "price" | "stock" | "url" | "boostEnabled" | "cpcBid"
>;

type FieldKey = "title" | "msrp" | "price" | "stock" | "url";
type Errors = Partial<Record<FieldKey, string>>;

const BLANK = {
  title: "",
  condition: "open-box-excellent" as CardCondition,
  msrp: "",
  price: "",
  stock: "",
  url: "",
  boostEnabled: false,
  cpcBid: 0.75,
};

export function InventoryForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Add listing",
  canBoost = true,
  className,
}: {
  /** Present when editing; omitted when creating. */
  initial?: MerchantListing;
  onSubmit: (draft: ListingDraft) => void;
  onCancel?: () => void;
  submitLabel?: string;
  /** False while the merchant is unapproved — boost stays locked off. */
  canBoost?: boolean;
  className?: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? BLANK.title);
  const [condition, setCondition] = useState<CardCondition>(
    initial?.condition ?? BLANK.condition,
  );
  const [msrp, setMsrp] = useState(
    initial ? String(initial.msrp) : BLANK.msrp,
  );
  const [price, setPrice] = useState(
    initial ? String(initial.price) : BLANK.price,
  );
  const [stock, setStock] = useState(
    initial ? String(initial.stock) : BLANK.stock,
  );
  const [url, setUrl] = useState(initial?.url ?? BLANK.url);
  const [boostEnabled, setBoostEnabled] = useState(
    canBoost ? (initial?.boostEnabled ?? BLANK.boostEnabled) : false,
  );
  const [cpcBid, setCpcBid] = useState(initial?.cpcBid ?? BLANK.cpcBid);
  const [errors, setErrors] = useState<Errors>({});

  const msrpNum = Number(msrp);
  const priceNum = Number(price);
  const forecast = forecastForBid(cpcBid);

  const discount =
    msrpNum > 0 && priceNum > 0 && priceNum <= msrpNum
      ? Math.round(((msrpNum - priceNum) / msrpNum) * 100)
      : null;

  const validate = (): Errors => {
    const next: Errors = {};

    if (!title.trim()) next.title = "Enter a listing title.";

    if (!msrp.trim() || Number.isNaN(msrpNum) || msrpNum <= 0) {
      next.msrp = "Enter an MSRP greater than zero.";
    }
    if (!price.trim() || Number.isNaN(priceNum) || priceNum <= 0) {
      next.price = "Enter a price greater than zero.";
    } else if (msrpNum > 0 && priceNum > msrpNum) {
      // An open-box price above MSRP isn't a deal — it's a data error.
      next.price = "Open-box price must be at or below MSRP.";
    }

    const stockNum = Number(stock);
    if (!stock.trim() || Number.isNaN(stockNum) || stockNum < 0) {
      next.stock = "Enter stock as zero or more.";
    } else if (!Number.isInteger(stockNum)) {
      next.stock = "Stock must be a whole number.";
    }

    if (!url.trim()) {
      next.url = "Enter the product URL.";
    } else {
      try {
        if (!/^https?:$/.test(new URL(url).protocol))
          next.url = "URL must start with http:// or https://";
      } catch {
        next.url = "Enter a valid URL.";
      }
    }

    return next;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit({
      title: title.trim(),
      condition,
      msrp: msrpNum,
      price: priceNum,
      stock: Number(stock),
      url: url.trim(),
      boostEnabled: canBoost && boostEnabled,
      cpcBid,
    });

    if (!initial) {
      setTitle("");
      setMsrp("");
      setPrice("");
      setStock("");
      setUrl("");
      setBoostEnabled(false);
      setCpcBid(BLANK.cpcBid);
      setErrors({});
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className={cn("flex flex-col gap-4", className)}
    >
      <Field
        label="Listing title"
        id="listing-title"
        value={title}
        onChange={setTitle}
        placeholder='Apple MacBook Air 13" M2 · 16GB / 512GB'
        error={errors.title}
      />

      {/* Condition ------------------------------------------------- */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Condition
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {CONDITION_OPTIONS.map((opt) => {
            const active = condition === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => setCondition(opt.value)}
                title={CONDITIONS[opt.value].description}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  active
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-surface-border bg-canvas/40 text-muted hover:border-accent/30",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Pricing --------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Retail MSRP"
          id="listing-msrp"
          value={msrp}
          onChange={setMsrp}
          placeholder="1199"
          inputMode="decimal"
          prefix="$"
          error={errors.msrp}
        />
        <Field
          label="Open-box price"
          id="listing-price"
          value={price}
          onChange={setPrice}
          placeholder="849"
          inputMode="decimal"
          prefix="$"
          error={errors.price}
        />
      </div>

      {discount !== null && (
        <p className="-mt-1 font-mono text-[11px] tabular-nums text-vip">
          {discount}% below MSRP · you net{" "}
          {formatCurrency(netPerUnit(priceNum), { cents: true })} per unit after
          the {Math.round(COMMISSION_RATE * 100)}% commission
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Stock on hand"
          id="listing-stock"
          value={stock}
          onChange={setStock}
          placeholder="4"
          inputMode="numeric"
          error={errors.stock}
        />
        <Field
          label="Product URL"
          id="listing-url"
          value={url}
          onChange={setUrl}
          placeholder="https://…"
          type="url"
          error={errors.url}
        />
      </div>

      {/* CPC boost ------------------------------------------------- */}
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border bg-canvas/40 p-3.5 transition",
          boostEnabled
            ? "border-accent/40"
            : "border-surface-border",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Rocket className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              CPC Boost
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Optional
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {canBoost
                ? "Sponsor this listing for priority search ranking. Billed per click, on top of commission."
                : "Available once your merchant account is approved."}
            </p>
          </div>
          <Switch
            checked={boostEnabled}
            onCheckedChange={setBoostEnabled}
            label="Enable CPC boost for this listing"
            tone="accent"
            disabled={!canBoost}
          />
        </div>

        {!canBoost && (
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-300/80">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Locked pending approval
          </p>
        )}

        {boostEnabled && canBoost && (
          <div className="flex flex-col gap-2 border-t border-surface-border pt-3">
            <label
              htmlFor="cpc-bid"
              className="flex items-baseline justify-between gap-2"
            >
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Bid per click
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-accent">
                {formatCurrency(cpcBid, { cents: true })}
              </span>
            </label>

            <input
              id="cpc-bid"
              type="range"
              min={CPC_MIN}
              max={CPC_MAX}
              step={CPC_STEP}
              value={cpcBid}
              onChange={(e) => setCpcBid(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-raised accent-accent"
            />

            <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
              <span>{formatCurrency(CPC_MIN, { cents: true })}</span>
              <span>{formatCurrency(CPC_MAX, { cents: true })}</span>
            </div>

            <dl className="mt-1 grid grid-cols-3 gap-2 border-t border-surface-border pt-3 text-center">
              <Forecast label="Est. rank" value={forecast.position} />
              <Forecast
                label="Clicks / day"
                value={`${forecast.dailyClicks}`}
              />
              <Forecast
                label="Spend / day"
                value={formatCurrency(forecast.dailySpend, { cents: true })}
              />
            </dl>
            <p className="text-center text-[10px] text-muted-foreground">
              Forecast only — actual placement is decided at auction.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" fullWidth>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Forecast({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  error,
  prefix,
  ...props
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  prefix?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "id"
>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
      >
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          {...props}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "h-11 w-full rounded-xl border bg-canvas/60 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1",
            prefix ? "pl-7" : "pl-3",
            error
              ? "border-rose-500/50 focus:border-rose-500/60 focus:ring-rose-500/40"
              : "border-surface-border focus:border-accent/50 focus:ring-accent/40",
          )}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-[11px] text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
