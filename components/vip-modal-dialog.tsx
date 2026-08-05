"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BellRing,
  CheckCircle2,
  Crown,
  Loader2,
  Lock,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import {
  VIP_INTRO_MONTHS,
  VIP_INTRO_PRICE,
  VIP_STANDARD_PRICE,
} from "@/components/vip-modal";

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
    icon: Sparkles,
    title: "VIP-Only Early Access",
    description:
      "See newly listed open-box and refurbished drops before they go public.",
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
      description={`${formatCurrency(VIP_INTRO_PRICE)}/mo for ${VIP_INTRO_MONTHS} months, then ${formatCurrency(VIP_STANDARD_PRICE)}/mo · cancel anytime`}
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
              {/* Pricing */}
              <div className="rounded-2xl border border-surface-border bg-canvas p-4">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Your plan
                </p>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-vip/25 bg-vip/[0.06] p-4">
                  <div>
                    <p className="text-sm font-medium">
                      First {VIP_INTRO_MONTHS} months
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Then {formatCurrency(VIP_STANDARD_PRICE)}/mo · cancel
                      anytime
                    </p>
                  </div>
                  <p className="font-mono text-2xl font-semibold tabular-nums text-vip-strong">
                    {formatCurrency(VIP_INTRO_PRICE)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /mo
                    </span>
                  </p>
                </div>
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
                    payload: { introPrice: VIP_INTRO_PRICE },
                  });
                  setPhase("checkout");
                }}
              >
                Go VIP — {formatCurrency(VIP_INTRO_PRICE)}/mo
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
                    First {VIP_INTRO_MONTHS} months, then{" "}
                    {formatCurrency(VIP_STANDARD_PRICE)}/mo
                  </p>
                </div>
                <p className="font-mono text-xl font-semibold tabular-nums">
                  {formatCurrency(VIP_INTRO_PRICE)}
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
                  Pay {formatCurrency(VIP_INTRO_PRICE)} today
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
                  Unlimited AI Vision search and SMS drop alerts are active now.
                </p>
              </div>

              <div className="w-full rounded-xl border border-vip/25 bg-vip/[0.06] p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Billing schedule
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-mono text-lg font-semibold tabular-nums text-vip-strong">
                    {formatCurrency(VIP_INTRO_PRICE)}/mo
                  </span>{" "}
                  for {VIP_INTRO_MONTHS} months, then{" "}
                  {formatCurrency(VIP_STANDARD_PRICE)}/mo
                </p>
              </div>

              <Button fullWidth onClick={onClose}>
                Start exploring
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

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
