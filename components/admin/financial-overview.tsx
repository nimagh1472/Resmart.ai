import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Crown,
  MousePointerClick,
  Percent,
  Wallet,
} from "lucide-react";
import {
  computeFinancials,
  type PlatformFinancials,
} from "@/lib/mock-admin";
import { cn, formatCurrency } from "@/lib/utils";

const compact = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });

export function FinancialOverview({
  financials,
  className,
}: {
  financials: PlatformFinancials;
  className?: string;
}) {
  const f = computeFinancials(financials);
  const { deltas } = financials;

  const cards = [
    {
      icon: Banknote,
      label: "Total GMV",
      value: compact(financials.gmv),
      exact: formatCurrency(financials.gmv),
      delta: deltas.gmv,
      sub: "Gross merchandise value",
      tone: "default" as const,
    },
    {
      icon: Percent,
      label: `Sales commission (${Math.round(financials.recordedCommissionRate * 100)}%)`,
      value: compact(f.salesCommission),
      exact: formatCurrency(f.salesCommission),
      delta: deltas.commission,
      sub: "Earned on completed sales",
      tone: "accent" as const,
    },
    {
      icon: Crown,
      label: "VIP SaaS revenue",
      value: compact(f.vipRevenue),
      exact: formatCurrency(f.vipRevenue),
      delta: deltas.vip,
      sub: `${financials.vipSubscribers.toLocaleString("en-US")} subs × ${formatCurrency(financials.recordedVipFee, { cents: true })}/mo`,
      tone: "vip" as const,
    },
    {
      icon: MousePointerClick,
      label: "CPC ad revenue",
      value: compact(financials.cpcAdRevenue),
      exact: formatCurrency(financials.cpcAdRevenue),
      delta: deltas.cpc,
      sub: "Merchant boost spend",
      tone: "accent" as const,
    },
    {
      icon: Wallet,
      label: "Cashback paid out",
      value: `−${compact(f.cashbackPaidOut)}`,
      exact: `−${formatCurrency(f.cashbackPaidOut)}`,
      delta: deltas.cashback,
      // A rise in cashback is a cost increase, so the arrow reads inverted.
      invertDelta: true,
      sub: `${(financials.recordedCashbackRate * 100).toFixed(2)}% of VIP-attributed GMV`,
      tone: "amber" as const,
    },
  ];

  return (
    <section className={cn("flex flex-col gap-4", className)} aria-labelledby="fin-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="fin-heading" className="font-heading text-lg font-semibold">
          Platform financials
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {financials.periodLabel}
        </span>
      </div>

      <div className="grid gap-px overflow-hidden rounded-2xl border border-surface-border bg-surface-border sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="flex flex-col gap-1.5 bg-surface px-4 py-4">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <c.icon className="h-3 w-3" aria-hidden="true" />
              {c.label}
            </p>
            <p
              title={c.exact}
              className={cn(
                "font-mono text-2xl font-semibold tabular-nums",
                c.tone === "accent" && "text-accent",
                c.tone === "vip" && "text-vip",
                c.tone === "amber" && "text-amber-300",
                c.tone === "default" && "text-foreground",
              )}
            >
              {c.value}
            </p>
            <Delta value={c.delta} invert={c.invertDelta} />
            <p className="text-[11px] leading-snug text-muted-foreground">
              {c.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Net roll-up: the four inflows minus cashback. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs tabular-nums text-muted-foreground">
          <span className="text-accent">{compact(f.salesCommission)}</span>
          <span>+</span>
          <span className="text-vip">{compact(f.vipRevenue)}</span>
          <span>+</span>
          <span className="text-accent">{compact(financials.cpcAdRevenue)}</span>
          <span>−</span>
          <span className="text-amber-300">{compact(f.cashbackPaidOut)}</span>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Net platform revenue
          </p>
          <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">
            {formatCurrency(f.netRevenue)}
          </p>
        </div>
      </div>
    </section>
  );
}

function Delta({ value, invert }: { value: number; invert?: boolean }) {
  const up = value >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <p
      className={cn(
        "flex items-center gap-0.5 font-mono text-[11px] tabular-nums",
        good ? "text-vip" : "text-rose-300",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {Math.abs(value * 100).toFixed(1)}%
      <span className="ml-1 text-muted-foreground">vs last period</span>
    </p>
  );
}
