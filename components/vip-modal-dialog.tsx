"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Crown,
  Loader2,
  Lock,
  ScanSearch,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CASHBACK_RATE } from "@/lib/mock-products";
import { track } from "@/lib/analytics";
import { cn, formatCurrency } from "@/lib/utils";
import { VIP_PRICE } from "@/components/vip-modal";

const FEATURES = [
  {
    icon: ScanSearch,
    title: "Unlimited AI Vision Search",
    description:
      "Screenshot or link anything — unlimited scans across every indexed retailer.",
  },
  {
    icon: BellRing,
    title: "SMS Drop Alerts",
    description:
      "Get texted the moment an open-box unit hits your target price.",
  },
  {
    icon: Wallet,
    title: "3% Cashback Wallet",
    description:
      "Earn 3% back on every purchase, withdrawable to your bank any time.",
  },
];

type Phase = "overview" | "checkout" | "processing" | "success";

export default function VipModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("overview");
  const [items, setItems] = useState(1);
  const [avgPrice, setAvgPrice] = useState(1000);

  const monthlyCashback = items * avgPrice * CASHBACK_RATE;
  const net = monthlyCashback - VIP_PRICE;
  const paysForItself = monthlyCashback >= VIP_PRICE;

  // Reset once the close animation has played out.
  useEffect(() => {
    if (open) return;
    const id = setTimeout(() => setPhase("overview"), 250);
    return () => clearTimeout(id);
  }, [open]);

  // Simulated Stripe round-trip.
  useEffect(() => {
    if (phase !== "processing") return;
    const id = setTimeout(() => {
      setPhase("success");
      track({ name: "vip_subscription_completed", payload: { simulated: true } });
    }, 2100);
    return () => clearTimeout(id);
  }, [phase]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ReSmart VIP"
      description={`${formatCurrency(VIP_PRICE)}/mo · cancel anytime`}
      className="sm:max-w-xl"
      dismissOnBackdrop={phase !== "processing"}
    >
      <div className="p-5">
        <AnimatePresence mode="wait" initial={false}>
          {/* ---------------------------------------------- overview */}
          {phase === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-6"
            >
              {/* Value calculator */}
              <div className="rounded-2xl border border-surface-border bg-canvas p-4">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Does it pay for itself?
                  </p>
                  {paysForItself && (
                    <Badge tone="emerald" size="sm">
                      Pays for itself
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <Slider
                    label="Open-box purchases / month"
                    value={items}
                    min={1}
                    max={5}
                    step={1}
                    onChange={setItems}
                    display={`${items} item${items > 1 ? "s" : ""}`}
                  />
                  <Slider
                    label="Average item price"
                    value={avgPrice}
                    min={200}
                    max={3000}
                    step={50}
                    onChange={setAvgPrice}
                    display={formatCurrency(avgPrice)}
                  />
                </div>

                {/* Buy → earn → net */}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <MathStep
                    label="You buy"
                    value={`${items}× ${formatCurrency(avgPrice)}`}
                  />
                  <StepArrow />
                  <MathStep
                    label="Cashback"
                    value={formatCurrency(monthlyCashback, { cents: true })}
                    tone="vip"
                  />
                  <StepArrow />
                  <MathStep
                    label={net >= 0 ? "Net gain / mo" : "Net cost / mo"}
                    value={`${net >= 0 ? "+" : "−"}${formatCurrency(
                      Math.abs(net),
                      { cents: true },
                    )}`}
                    tone={net >= 0 ? "vip" : "muted"}
                  />
                </div>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {paysForItself ? (
                    <>
                      One {formatCurrency(avgPrice)} open-box buy returns{" "}
                      <span className="font-mono text-vip-strong">
                        {formatCurrency(avgPrice * CASHBACK_RATE, {
                          cents: true,
                        })}
                      </span>{" "}
                      — the subscription pays for itself instantly.
                    </>
                  ) : (
                    <>
                      Spend{" "}
                      <span className="font-mono text-accent-strong">
                        {formatCurrency(Math.ceil(VIP_PRICE / CASHBACK_RATE))}
                      </span>{" "}
                      a month to break even on the subscription.
                    </>
                  )}
                </p>
              </div>

              {/* Features */}
              <ul className="flex flex-col gap-3">
                {FEATURES.map(({ icon: Icon, title, description }) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-lg bg-vip/10 p-2 ring-1 ring-inset ring-vip/20">
                      <Icon className="h-4 w-4 text-vip-strong" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <Button
                variant="success"
                size="lg"
                fullWidth
                leftIcon={<Crown className="h-4 w-4" />}
                onClick={() => {
                  track({
                    name: "vip_checkout_started",
                    payload: { items, avgPrice, monthlyCashback },
                  });
                  setPhase("checkout");
                }}
              >
                Go VIP — {formatCurrency(VIP_PRICE)}/mo
              </Button>
            </motion.div>
          )}

          {/* ---------------------------------------------- checkout */}
          {phase === "checkout" && (
            <motion.div
              key="checkout"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-5"
            >
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-600">
                Demo checkout — this is a simulated Stripe flow. No card is
                charged and nothing is transmitted.
              </div>

              <div className="flex items-center justify-between rounded-xl border border-surface-border bg-canvas p-4">
                <div>
                  <p className="font-heading font-medium">ReSmart VIP</p>
                  <p className="text-xs text-muted-foreground">
                    Monthly · cancel anytime
                  </p>
                </div>
                <p className="font-mono text-xl font-semibold tabular-nums">
                  {formatCurrency(VIP_PRICE)}
                </p>
              </div>

              <MockCardForm />

              <div className="flex flex-col gap-2">
                <Button
                  variant="success"
                  size="lg"
                  fullWidth
                  leftIcon={<Lock className="h-4 w-4" />}
                  onClick={() => setPhase("processing")}
                >
                  Pay {formatCurrency(VIP_PRICE)}
                </Button>
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => setPhase("overview")}
                >
                  Back
                </Button>
              </div>

              <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Payments would be processed by Stripe. ReSmart never stores card
                details.
              </p>
            </motion.div>
          )}

          {/* -------------------------------------------- processing */}
          {phase === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-16"
            >
              <Loader2 className="h-8 w-8 animate-spin text-vip-strong" />
              <p className="text-sm text-muted">Confirming with Stripe…</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Simulated · no charge
              </p>
            </motion.div>
          )}

          {/* ----------------------------------------------- success */}
          {phase === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="flex flex-col items-center gap-5 py-8 text-center"
            >
              <span className="rounded-2xl bg-vip/10 p-4 ring-1 ring-inset ring-vip/25">
                <CheckCircle2 className="h-9 w-9 text-vip-strong" />
              </span>

              <div>
                <h3 className="font-heading text-xl font-semibold">
                  You&apos;re VIP.
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  3% cashback is now active on every purchase.
                </p>
              </div>

              <div className="w-full rounded-xl border border-vip/25 bg-vip/[0.06] p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Projected first-month cashback
                </p>
                <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-vip-strong">
                  {formatCurrency(monthlyCashback, { cents: true })}
                </p>
              </div>

              <Button fullWidth onClick={onClose}>
                Start saving
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-xs text-muted">
        {label}
        <span className="font-mono tabular-nums text-foreground">
          {display}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-raised accent-vip"
      />
    </label>
  );
}

function MathStep({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "vip" | "muted";
}) {
  return (
    <div className="flex-1 rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-center">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-semibold tabular-nums",
          tone === "vip" && "text-vip-strong",
          tone === "muted" && "text-muted-foreground",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StepArrow() {
  return (
    <div className="flex items-center justify-center text-muted-foreground">
      <ArrowRight className="h-4 w-4 rotate-90 sm:rotate-0" aria-hidden="true" />
    </div>
  );
}

/** Cosmetic card form. Deliberately inert — nothing here is submitted. */
function MockCardForm() {
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12 / 34");
  const [cvc, setCvc] = useState("123");

  return (
    <div className="flex flex-col gap-2">
      <Field
        label="Card number"
        value={card}
        onChange={(v) =>
          setCard(
            v
              .replace(/\D/g, "")
              .slice(0, 16)
              .replace(/(.{4})/g, "$1 ")
              .trim(),
          )
        }
        inputMode="numeric"
        autoComplete="off"
      />
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Expiry"
          value={expiry}
          onChange={setExpiry}
          inputMode="numeric"
          autoComplete="off"
        />
        <Field
          label="CVC"
          value={cvc}
          onChange={(v) => setCvc(v.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          autoComplete="off"
        />
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">
        Prefilled with Stripe&apos;s 4242 test card.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string;
  /** Takes the raw string, not the event — callers reformat as they type. */
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-surface-border bg-canvas px-3 font-mono text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus:border-vip/50 focus:outline-none focus:ring-1 focus:ring-vip/40"
      />
    </label>
  );
}
