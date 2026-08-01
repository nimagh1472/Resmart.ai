"use client";

import { useState } from "react";
import { CashbackWalletCard } from "@/components/account/cashback-wallet-card";
import { MOCK_WALLET, type CashbackWallet } from "@/lib/mock-account";

/** Owns wallet state so the payout flow can debit the balance. */
export function AccountWallet({ className }: { className?: string }) {
  const [wallet, setWallet] = useState<CashbackWallet>(MOCK_WALLET);

  return (
    <CashbackWalletCard
      wallet={wallet}
      className={className}
      onPayout={(amount) =>
        setWallet((w) => ({
          ...w,
          available: Math.max(0, w.available - amount),
          paidOut: w.paidOut + amount,
        }))
      }
    />
  );
}
