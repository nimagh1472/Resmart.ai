"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  currentVipRate,
  isInVipIntroPeriod,
  VIP_INTRO_MONTHS,
  VIP_STANDARD_PRICE,
} from "@/components/vip-modal";
import { formatDate, type AccountUser } from "@/lib/mock-account";
import { formatCurrency } from "@/lib/utils";

const FEATURES = [
  "Unlimited AI Vision Search",
  "SMS Drop Alerts",
  "VIP-Only Early Access",
];

export function SubscriptionSection({ user }: { user: AccountUser }) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const rate = currentVipRate(user.memberSince);
  const inIntro = isInVipIntroPeriod(user.memberSince);

  const openPortal = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setNotice(data.message ?? "Could not open the billing portal.");
    } catch {
      setNotice("Could not reach the billing portal. Try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="flex flex-col gap-5 rounded-2xl border border-surface-border bg-surface shadow-card p-5 sm:p-6"
      aria-labelledby="subscription-heading"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-vip/10 p-2 ring-1 ring-inset ring-vip/20">
          <CreditCard className="h-4 w-4 text-vip-strong" aria-hidden="true" />
        </span>
        <h2
          id="subscription-heading"
          className="font-heading text-sm font-semibold"
        >
          Subscription
        </h2>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-vip/25 bg-vip/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-heading font-semibold text-vip-strong">ReSmart VIP</p>
          <p className="text-xs text-muted-foreground">
            Renews {formatDate(user.renewsOn)} · cancel anytime
          </p>
          {inIntro && (
            <p className="text-xs text-muted-foreground">
              Intro rate for your first {VIP_INTRO_MONTHS} months, then{" "}
              {formatCurrency(VIP_STANDARD_PRICE)}/mo
            </p>
          )}
        </div>
        <p className="font-mono text-2xl font-semibold tabular-nums">
          {formatCurrency(rate)}
          <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">
            / mo
          </span>
        </p>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {FEATURES.map((f) => (
          <li
            key={f}
            className="flex items-center gap-1.5 text-xs text-muted"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-vip"
            />
            {f}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          onClick={openPortal}
          loading={loading}
          rightIcon={<ExternalLink className="h-4 w-4" />}
        >
          Manage Subscription
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Opens the Stripe Customer Portal to update your card, download
          invoices, or cancel.
        </p>
      </div>

      {notice && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-600"
        >
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}
    </section>
  );
}
