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

export const VIP_PRICE = 14.99;

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
