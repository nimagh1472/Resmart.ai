"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";

// The dialog (calculator, checkout, success states — ~500 lines with
// framer-motion) is only ever seen after a click, so it's split into its own
// chunk instead of shipping in every page's initial bundle via the provider
// mounted in the root layout.
const VipModal = dynamic(() => import("@/components/vip-modal-dialog"), {
  ssr: false,
});

/** Promotional rate for a new subscriber's first `VIP_INTRO_MONTHS` months. */
export const VIP_INTRO_PRICE = 4.99;
export const VIP_INTRO_MONTHS = 3;
/** Recurring rate once the intro period ends. */
export const VIP_STANDARD_PRICE = 14.99;

/** True while a member (by join date) is still within the intro window. */
export function isInVipIntroPeriod(
  memberSince: string,
  asOf: Date = new Date(),
): boolean {
  const start = new Date(memberSince);
  const months =
    (asOf.getFullYear() - start.getFullYear()) * 12 +
    (asOf.getMonth() - start.getMonth());
  return months < VIP_INTRO_MONTHS;
}

/** The rate a member is actually billed today, given when they joined. */
export function currentVipRate(memberSince: string, asOf: Date = new Date()): number {
  return isInVipIntroPeriod(memberSince, asOf) ? VIP_INTRO_PRICE : VIP_STANDARD_PRICE;
}

/* ------------------------------------------------------------------ */
/* Context — lets the navbar and any CTA open the same modal           */
/* ------------------------------------------------------------------ */

const VipContext = createContext<{ openVip: () => void } | null>(null);

export function useVip() {
  const ctx = useContext(VipContext);
  if (!ctx) throw new Error("useVip must be used inside <VipProvider>");
  return ctx;
}

export function VipProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openVip = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openVip }), [openVip]);

  return (
    <VipContext.Provider value={value}>
      {children}
      <VipModal open={open} onClose={() => setOpen(false)} />
    </VipContext.Provider>
  );
}
