import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Coins,
  MousePointerClick,
  PackageSearch,
  Rocket,
  ShieldCheck,
  Target,
  Wallet,
} from "lucide-react";
import { MerchantHeader } from "@/components/merchants/merchant-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { COMMISSION_RATE, CPC_MAX, CPC_MIN } from "@/lib/mock-merchant";
import { formatCurrency } from "@/lib/utils";

const COMMISSION_PCT = Math.round(COMMISSION_RATE * 100);
const CPC_RANGE = `${formatCurrency(CPC_MIN, { cents: true })}–${formatCurrency(
  CPC_MAX,
  { cents: true },
)}`;

export const metadata: Metadata = {
  title: "Merchant Portal",
  description: `Reach 80M+ high-intent open-box buyers. ${COMMISSION_PCT}% commission on completed sales, plus optional CPC boost — no listing fees.`,
};

const STATS = [
  { value: "80M+", label: "High-intent buyers reached" },
  { value: "12.4M", label: "Listings indexed" },
  { value: "4.3%", label: "Average sponsored CTR" },
  { value: `${COMMISSION_PCT}%`, label: "Flat commission on sales" },
];

const BENEFITS = [
  {
    icon: Coins,
    title: "Commission only on sales",
    description: `A flat ${COMMISSION_PCT}% is taken when an item actually sells. No listing fees, no monthly minimum, nothing charged on inventory that sits.`,
  },
  {
    icon: MousePointerClick,
    title: "Optional CPC boost",
    description: `Want priority ranking? Bid ${CPC_RANGE} per click to sponsor a listing. Entirely optional — unboosted listings still rank on price and condition.`,
  },
  {
    icon: Target,
    title: "Buyers already in-market",
    description:
      "Every visitor arrived searching for open-box or refurbished stock. No awareness spend, no top-of-funnel waste.",
  },
  {
    icon: PackageSearch,
    title: "Move aging open-box inventory",
    description:
      "Surface graded returns and refurbished units next to new-condition comparisons, where the discount does the selling.",
  },
  {
    icon: BarChart3,
    title: "Transparent attribution",
    description:
      "Impressions, CTR, and spend per listing in real time. Every click is logged first-party and reconcilable.",
  },
  {
    icon: Wallet,
    title: "Prepaid ad wallet",
    description:
      "Top up once and set auto-recharge. Spend never exceeds your balance — no surprise invoices.",
  },
  {
    icon: ShieldCheck,
    title: "Condition-verified placement",
    description:
      "AI grading keeps your listings alongside comparable stock, so your pricing reads fairly against the field.",
  },
];

const STEPS = [
  {
    title: "Get approved",
    body: "Submit your business details. Review typically completes within 48 hours — you can load inventory while you wait.",
  },
  {
    title: "List your inventory",
    body: "Title, condition, MSRP, open-box price, stock, and destination URL. Add listings manually or sync a feed.",
  },
  {
    title: `Pay ${COMMISSION_PCT}% when it sells`,
    body: `Commission is taken only on completed sales. Add a ${CPC_RANGE} CPC boost if you want priority ranking — that part is optional.`,
  },
];

export default function MerchantsPage() {
  return (
    <>
      <MerchantHeader />

      <main className="min-h-dvh bg-canvas">
        {/* Hero ---------------------------------------------------- */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="absolute left-1/2 top-[-16rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
          </div>

          <div className="px-gutter mx-auto flex max-w-4xl flex-col items-center gap-6 py-16 text-center sm:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-accent">
              For Retailers &amp; Refurbishers
            </span>

            <h1 className="text-balance text-3xl font-bold leading-[1.12] sm:text-5xl sm:leading-[1.08] lg:text-6xl">
              Reach{" "}
              <span className="bg-accent-gradient bg-clip-text text-transparent">
                80M+
              </span>{" "}
              High-Intent Open-Box Buyers.{" "}
              <span className="text-accent">Pay Only For Clicks.</span>
            </h1>

            <p className="max-w-2xl text-balance text-base text-muted sm:text-lg">
              List your open-box and certified refurbished inventory where
              buyers are already comparing it. No listing fees and no monthly
              minimum — a flat {COMMISSION_PCT}% when an item sells, plus an
              optional CPC boost you control.
            </p>

            <div className="flex w-full flex-col gap-3 pt-2 sm:w-auto sm:flex-row">
              <Link
                href="/merchants/dashboard"
                className={buttonStyles({ size: "lg", className: "w-full sm:w-auto" })}
              >
                Open Merchant Dashboard
              </Link>
              <Link
                href="#pricing"
                className={buttonStyles({ variant: "secondary", size: "lg", className: "w-full sm:w-auto" })}
              >
                See pricing
              </Link>
            </div>

            <dl className="mt-10 grid w-full grid-cols-2 gap-px overflow-hidden rounded-2xl border border-surface-border bg-surface-border md:grid-cols-4">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col gap-1 bg-surface px-4 py-5"
                >
                  <dt className="font-mono text-2xl font-semibold tabular-nums text-accent">
                    {s.value}
                  </dt>
                  <dd className="text-xs text-muted-foreground">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Benefits ------------------------------------------------ */}
        <section className="border-y border-surface-border bg-canvas-soft py-20 sm:py-24">
          <div className="px-gutter mx-auto max-w-6xl">
            <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                Why ReSmart
              </span>
              <h2 className="text-balance text-2xl font-bold sm:text-3xl lg:text-4xl">
                Performance pricing for secondary-market inventory
              </h2>
            </div>

            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map(({ icon: Icon, title, description }) => (
                <li
                  key={title}
                  className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface p-5"
                >
                  <span className="w-fit rounded-lg bg-accent/10 p-2 ring-1 ring-inset ring-accent/20">
                    <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                  </span>
                  <h3 className="font-heading font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted">
                    {description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing / how it works ---------------------------------- */}
        <section id="pricing" className="scroll-mt-24 py-20 sm:py-24">
          <div className="px-gutter mx-auto max-w-5xl">
            <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                Pricing
              </span>
              <h2 className="text-balance text-2xl font-bold sm:text-3xl lg:text-4xl">
                One flat commission. Boost only if you want to.
              </h2>
            </div>

            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="flex flex-col gap-2 rounded-2xl border border-surface-border bg-surface p-5"
                >
                  <span className="font-mono text-xs text-accent">
                    0{i + 1}
                  </span>
                  <h3 className="font-heading font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>

            {/* Two-part pricing: the base tier everyone pays, plus the
                optional add-on. Shown side by side so neither reads as a
                hidden fee discovered later. */}
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-2xl border border-vip/30 bg-surface p-8">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-vip/25 bg-vip/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-vip">
                  <Coins className="h-3 w-3" aria-hidden="true" />
                  Base — everyone
                </span>
                <p className="font-mono text-4xl font-semibold tabular-nums text-vip">
                  {COMMISSION_PCT}%
                  <span className="ml-1 font-sans text-base font-normal text-muted-foreground">
                    per completed sale
                  </span>
                </p>
                <p className="text-sm leading-relaxed text-muted">
                  Charged only when an item sells. No listing fees, no monthly
                  minimum, and nothing owed on inventory that doesn&apos;t move.
                </p>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-accent/25 bg-surface p-8">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-accent">
                  <Rocket className="h-3 w-3" aria-hidden="true" />
                  Optional add-on
                </span>
                <p className="font-mono text-4xl font-semibold tabular-nums text-accent">
                  {CPC_RANGE}
                  <span className="ml-1 font-sans text-base font-normal text-muted-foreground">
                    / click
                  </span>
                </p>
                <p className="text-sm leading-relaxed text-muted">
                  CPC boost buys priority ranking in comparison results.
                  Impressions are free, spend is capped by your prepaid
                  balance, and you can pause it any time.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3 text-center">
              <p className="max-w-lg text-sm text-muted-foreground">
                A boosted listing pays both: {COMMISSION_PCT}% when it sells,
                plus your bid on each click it receives.
              </p>
              <Link
                href="/merchants/dashboard"
                className={buttonStyles({ size: "lg" })}
              >
                Start listing inventory
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
