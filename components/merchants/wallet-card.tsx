"use client";

import { AlertTriangle, Percent, Plus, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  COMMISSION_RATE,
  type MerchantWallet,
} from "@/lib/mock-merchant";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export function WalletCard({
  wallet,
  totalSalesRevenue,
  commissionsOwed,
  onToggleAutoRecharge,
  onAddFunds,
  className,
}: {
  wallet: MerchantWallet;
  /** Derived from live listings, not stored — keeps the two from drifting. */
  totalSalesRevenue: number;
  commissionsOwed: number;
  onToggleAutoRecharge: (on: boolean) => void;
  onAddFunds: () => void;
  className?: string;
}) {
  const {
    adSpendBalance,
    autoRecharge,
    rechargeThreshold,
    rechargeAmount,
    adSpendToday,
    commissionsSettled,
    nextSettlementOn,
  } = wallet;

  const low = adSpendBalance < rechargeThreshold;
  // Runway against today's burn rate, which is what merchants actually watch.
  const daysLeft =
    adSpendToday > 0 ? Math.floor(adSpendBalance / adSpendToday) : null;
  const netPayout = totalSalesRevenue - commissionsOwed - commissionsSettled;

  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-2xl border bg-surface p-5",
        low && !autoRecharge ? "border-amber-400/40" : "border-surface-border",
        className,
      )}
      aria-labelledby="wallet-heading"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-accent/10 p-2 ring-1 ring-inset ring-accent/20">
          <Wallet className="h-4 w-4 text-accent-strong" aria-hidden="true" />
        </span>
        <h2 id="wallet-heading" className="font-heading text-sm font-semibold">
          Merchant Wallet
        </h2>
      </div>

      {/* CPC ad spend --------------------------------------------- */}
      <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-canvas p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              CPC Ad Spend Balance
            </p>
            <p className="font-mono text-3xl font-semibold tabular-nums leading-tight text-foreground">
              {formatCurrency(adSpendBalance, { cents: true })}
            </p>
            {daysLeft !== null && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                ≈ {daysLeft} days at {formatCurrency(adSpendToday, { cents: true })}
                /day
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={onAddFunds}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            Add funds
          </Button>
        </div>

        {low && !autoRecharge && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-600">
            <AlertTriangle
              className="mt-px h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            Below {formatCurrency(rechargeThreshold)}. Boosted listings stop
            serving at zero — sales listings stay live.
          </p>
        )}

        <div className="flex items-start justify-between gap-4 border-t border-surface-border pt-3">
          <div>
            <p className="text-sm font-medium">Auto-recharge</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {autoRecharge ? (
                <>
                  Adds{" "}
                  <span className="font-mono text-vip-strong">
                    {formatCurrency(rechargeAmount)}
                  </span>{" "}
                  below{" "}
                  <span className="font-mono">
                    {formatCurrency(rechargeThreshold)}
                  </span>
                  .
                </>
              ) : (
                "Off — boosts pause when the balance empties."
              )}
            </p>
          </div>
          <Switch
            checked={autoRecharge}
            onCheckedChange={onToggleAutoRecharge}
            label="Auto-recharge ad spend balance"
          />
        </div>
      </div>

      {/* Sales & commission --------------------------------------- */}
      <div className="grid gap-px overflow-hidden rounded-xl border border-surface-border bg-surface-border sm:grid-cols-2">
        <Figure
          icon={TrendingUp}
          label="Total sales revenue"
          value={formatCurrency(totalSalesRevenue, { cents: true })}
          tone="vip"
        />
        <Figure
          icon={Percent}
          label="Commissions owed"
          value={formatCurrency(commissionsOwed, { cents: true })}
          hint={`${Math.round(COMMISSION_RATE * 100)}% of completed sales`}
          tone="amber"
        />
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <Row
          label="Commission settled to date"
          value={formatCurrency(commissionsSettled, { cents: true })}
        />
        <Row
          label="Net payout after commission"
          value={formatCurrency(Math.max(0, netPayout), { cents: true })}
          strong
        />
        <Row
          label="Next settlement"
          value={formatDate(nextSettlementOn)}
        />
      </div>

      <p className="rounded-lg bg-surface-raised/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Commission is charged only on completed sales. CPC boost is billed
        separately from the ad spend balance above — the two never draw from
        the same funds.
      </p>
    </section>
  );
}

function Figure({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "vip" | "amber";
}) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-4 py-3.5">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </p>
      <p
        className={cn(
          "font-mono text-xl font-semibold tabular-nums",
          tone === "vip" && "text-vip-strong",
          tone === "amber" && "text-amber-600",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          strong ? "font-semibold text-foreground" : "text-muted",
        )}
      >
        {value}
      </span>
    </div>
  );
}
