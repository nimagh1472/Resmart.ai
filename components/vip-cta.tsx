"use client";

import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVip, VIP_PRICE } from "@/components/vip-modal";
import { formatCurrency } from "@/lib/utils";

export function VipCta() {
  const { openVip } = useVip();

  return (
    <section className="px-gutter mx-auto max-w-5xl pb-20 sm:pb-24">
      <div className="relative overflow-hidden rounded-2xl border border-vip/25 bg-surface p-8 text-center sm:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-vip/15 blur-[100px]"
        />

        <div className="relative flex flex-col items-center gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-vip/25 bg-vip/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-vip">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            ReSmart VIP
          </span>

          <h2 className="text-balance text-2xl font-bold sm:text-3xl lg:text-4xl">
            One open-box buy pays for the whole year&apos;s membership
          </h2>

          <p className="max-w-xl text-balance text-muted">
            3% cashback on every purchase, unlimited AI Vision searches, and SMS
            alerts the moment a price drops — {formatCurrency(VIP_PRICE)}/mo,
            cancel anytime.
          </p>

          <Button
            variant="success"
            size="lg"
            onClick={openVip}
            leftIcon={<Crown className="h-4 w-4" />}
            className="mt-2"
          >
            See the VIP math
          </Button>
        </div>
      </div>
    </section>
  );
}
