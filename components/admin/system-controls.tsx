"use client";

import { useState } from "react";
import { RotateCcw, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_SETTINGS,
  SETTING_BOUNDS,
  projectSettingsImpact,
  type PlatformFinancials,
  type PlatformSettings,
} from "@/lib/mock-admin";
import { cn, formatCurrency } from "@/lib/utils";

/**
 * Edits are staged locally and only committed on Save, so a mid-drag slider
 * value never becomes live platform pricing.
 */
export function SystemControls({
  settings,
  financials,
  onSave,
  className,
}: {
  settings: PlatformSettings;
  financials: PlatformFinancials;
  onSave: (next: PlatformSettings) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<PlatformSettings>(settings);
  const [saved, setSaved] = useState(false);

  const dirty =
    draft.vipFee !== settings.vipFee ||
    draft.cashbackRate !== settings.cashbackRate ||
    draft.commissionRate !== settings.commissionRate;

  const impact = projectSettingsImpact(financials, draft);

  const patch = (p: Partial<PlatformSettings>) => {
    setDraft((d) => ({ ...d, ...p }));
    setSaved(false);
  };

  const save = () => {
    onSave(draft);
    setSaved(true);
  };

  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-2xl border border-surface-border bg-surface shadow-card p-5",
        className,
      )}
      aria-labelledby="controls-heading"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-accent/10 p-2 ring-1 ring-inset ring-accent/20">
          <SlidersHorizontal
            className="h-4 w-4 text-accent-strong"
            aria-hidden="true"
          />
        </span>
        <h2
          id="controls-heading"
          className="font-heading text-sm font-semibold"
        >
          System Controls
        </h2>
      </div>

      {/* VIP fee ---------------------------------------------------- */}
      <label className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            VIP subscription fee
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            default {formatCurrency(DEFAULT_SETTINGS.vipFee, { cents: true })}
          </span>
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
            $
          </span>
          <input
            type="number"
            min={SETTING_BOUNDS.vipFee.min}
            max={SETTING_BOUNDS.vipFee.max}
            step="0.01"
            value={draft.vipFee}
            onChange={(e) => patch({ vipFee: Number(e.target.value) })}
            className="h-11 w-full rounded-xl border border-surface-border bg-canvas pl-7 pr-16 font-mono text-sm tabular-nums text-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
            / month
          </span>
        </div>
      </label>

      {/* Cashback --------------------------------------------------- */}
      <PercentSlider
        id="cashback-rate"
        label="Member cashback rate"
        value={draft.cashbackRate}
        bounds={SETTING_BOUNDS.cashbackRate}
        defaultValue={DEFAULT_SETTINGS.cashbackRate}
        decimals={2}
        tone="vip"
        onChange={(cashbackRate) => patch({ cashbackRate })}
      />

      {/* Commission ------------------------------------------------- */}
      <PercentSlider
        id="commission-rate"
        label="Default commission rate"
        value={draft.commissionRate}
        bounds={SETTING_BOUNDS.commissionRate}
        defaultValue={DEFAULT_SETTINGS.commissionRate}
        decimals={1}
        tone="accent"
        onChange={(commissionRate) => patch({ commissionRate })}
      />

      {/* Projected impact ------------------------------------------ */}
      <div className="flex flex-col gap-2 rounded-xl border border-surface-border bg-canvas p-3.5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Projected monthly impact
        </p>

        {dirty ? (
          <>
            <ImpactRow label="Commission" value={impact.commission} />
            <ImpactRow label="VIP subscriptions" value={impact.vip} />
            <ImpactRow label="Cashback cost" value={-impact.cashback} />
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-surface-border pt-2">
              <span className="text-xs font-medium">Net change</span>
              <span
                className={cn(
                  "font-mono text-lg font-semibold tabular-nums",
                  impact.net >= 0 ? "text-vip-strong" : "text-rose-600",
                )}
              >
                {impact.net >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(impact.net))}
              </span>
            </div>
            <p className="text-[10px] leading-snug text-muted-foreground">
              Applied to this period&apos;s volumes. A forecast — it does not
              restate revenue already booked at the previous rates.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            No pending changes. Adjust a value to preview its effect.
          </p>
        )}
      </div>

      {dirty && draft.cashbackRate > draft.commissionRate && (
        <p className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-3 py-2 text-xs text-rose-700">
          <TriangleAlert
            className="mt-px h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
          Cashback exceeds commission — every sale would pay out more than it
          earns.
        </p>
      )}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          fullWidth
          disabled={!dirty}
          onClick={() => {
            setDraft(settings);
            setSaved(false);
          }}
          leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
        >
          Revert
        </Button>
        <Button fullWidth disabled={!dirty} onClick={save}>
          Save settings
        </Button>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "text-center text-xs transition-opacity",
          saved && !dirty ? "text-vip-strong opacity-100" : "opacity-0",
        )}
      >
        Settings saved and applied platform-wide.
      </p>
    </section>
  );
}

function PercentSlider({
  id,
  label,
  value,
  bounds,
  defaultValue,
  decimals,
  tone,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  bounds: { min: number; max: number; step: number };
  defaultValue: number;
  decimals: number;
  tone: "accent" | "vip";
  onChange: (v: number) => void;
}) {
  const pct = (n: number) => `${(n * 100).toFixed(decimals)}%`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "font-mono text-lg font-semibold tabular-nums",
            tone === "vip" ? "text-vip-strong" : "text-accent-strong",
          )}
        >
          {pct(value)}
        </span>
      </label>

      <input
        id={id}
        type="range"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-raised",
          tone === "vip" ? "accent-vip" : "accent-accent",
        )}
      />

      <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
        <span>{pct(bounds.min)}</span>
        <span>default {pct(defaultValue)}</span>
        <span>{pct(bounds.max)}</span>
      </div>
    </div>
  );
}

function ImpactRow({ label, value }: { label: string; value: number }) {
  const zero = Math.abs(value) < 0.005;
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          zero
            ? "text-muted-foreground"
            : value > 0
              ? "text-vip-strong"
              : "text-rose-600",
        )}
      >
        {zero ? "—" : `${value > 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`}
      </span>
    </div>
  );
}
