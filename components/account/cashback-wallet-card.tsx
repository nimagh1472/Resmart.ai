"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  Landmark,
  Loader2,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  PAYOUT_MINIMUM,
  type CashbackWallet,
} from "@/lib/mock-account";
import { cn, formatCurrency } from "@/lib/utils";

export function CashbackWalletCard({
  wallet,
  onPayout,
  className,
}: {
  wallet: CashbackWallet;
  onPayout: (amount: number) => void;
  className?: string;
}) {
  const [payoutOpen, setPayoutOpen] = useState(false);
  const { totalEarned, pending, available, paidOut } = wallet;

  const canPayout = available >= PAYOUT_MINIMUM;

  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-2xl border border-surface-border bg-surface p-5 sm:p-6",
        className,
      )}
      aria-labelledby="cashback-heading"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-vip/10 p-2 ring-1 ring-inset ring-vip/20">
          <Wallet className="h-4 w-4 text-vip" aria-hidden="true" />
        </span>
        <h2 id="cashback-heading" className="font-heading text-sm font-semibold">
          Cashback Wallet
        </h2>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          3% VIP rate
        </span>
      </div>

      <div className="grid gap-px overflow-hidden rounded-xl border border-surface-border bg-surface-border sm:grid-cols-3">
        <Figure
          icon={PiggyBank}
          label="Total earned"
          value={formatCurrency(totalEarned, { cents: true })}
        />
        <Figure
          icon={Clock}
          label="Pending"
          value={formatCurrency(pending, { cents: true })}
          hint="Clears ~30 days after purchase"
        />
        <Figure
          icon={ArrowDownToLine}
          label="Available"
          value={formatCurrency(available, { cents: true })}
          tone="vip"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Lifetime {formatCurrency(totalEarned, { cents: true })} ={" "}
        {formatCurrency(available, { cents: true })} available +{" "}
        {formatCurrency(pending, { cents: true })} pending +{" "}
        {formatCurrency(paidOut, { cents: true })} already paid out.
      </p>

      <div className="flex flex-col gap-2">
        <Button
          variant="success"
          fullWidth
          disabled={!canPayout}
          onClick={() => setPayoutOpen(true)}
          leftIcon={<Landmark className="h-4 w-4" />}
        >
          Request Payout
        </Button>
        {!canPayout && (
          <p className="text-center text-[11px] text-muted-foreground">
            Minimum payout is {formatCurrency(PAYOUT_MINIMUM)}. Keep shopping to
            reach it.
          </p>
        )}
      </div>

      <PayoutModal
        open={payoutOpen}
        onClose={() => setPayoutOpen(false)}
        available={available}
        onConfirm={onPayout}
      />
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
  tone?: "default" | "vip";
}) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-4 py-3.5">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </p>
      <p
        className={cn(
          "font-mono text-2xl font-semibold tabular-nums",
          tone === "vip" ? "text-vip" : "text-foreground",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

type PayoutPhase = "form" | "processing" | "done";

function PayoutModal({
  open,
  onClose,
  available,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  available: number;
  onConfirm: (amount: number) => void;
}) {
  const [phase, setPhase] = useState<PayoutPhase>("form");
  const [amount, setAmount] = useState(available);

  // Reset after the close animation; re-sync if the balance changed.
  useEffect(() => {
    if (open) {
      setAmount(available);
      return;
    }
    const id = setTimeout(() => setPhase("form"), 250);
    return () => clearTimeout(id);
  }, [open, available]);

  useEffect(() => {
    if (phase !== "processing") return;
    const id = setTimeout(() => {
      onConfirm(amount);
      setPhase("done");
    }, 1600);
    return () => clearTimeout(id);
  }, [phase, amount, onConfirm]);

  const valid = amount >= PAYOUT_MINIMUM && amount <= available;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request payout"
      description="Transfers land in your bank in 1–3 business days."
      dismissOnBackdrop={phase !== "processing"}
    >
      <div className="p-5">
        {phase === "form" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-300">
              Demo flow — no funds move.
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Amount
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  min={PAYOUT_MINIMUM}
                  max={available}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="h-11 w-full rounded-xl border border-surface-border bg-canvas/60 pl-7 pr-3 font-mono text-sm tabular-nums text-foreground focus:border-vip/50 focus:outline-none focus:ring-1 focus:ring-vip/40"
                />
              </div>
              <span className="text-[11px] text-muted-foreground">
                {formatCurrency(available, { cents: true })} available ·
                minimum {formatCurrency(PAYOUT_MINIMUM)}
              </span>
            </label>

            <div className="flex items-center justify-between rounded-xl border border-surface-border bg-canvas/40 px-3.5 py-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm">Chase •••• 4021</span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Default
              </span>
            </div>

            <Button
              variant="success"
              fullWidth
              disabled={!valid}
              onClick={() => setPhase("processing")}
            >
              Withdraw {formatCurrency(Math.max(amount, 0), { cents: true })}
            </Button>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-7 w-7 animate-spin text-vip" />
            <p className="text-sm text-muted">Submitting transfer…</p>
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="rounded-2xl bg-vip/10 p-4 ring-1 ring-inset ring-vip/25">
              <CheckCircle2 className="h-8 w-8 text-vip" />
            </span>
            <div>
              <h3 className="font-heading text-lg font-semibold">
                Payout requested
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatCurrency(amount, { cents: true })} is on its way to Chase
                •••• 4021.
              </p>
            </div>
            <Button fullWidth onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
