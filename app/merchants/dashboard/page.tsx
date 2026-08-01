import type { Metadata } from "next";
import { MerchantHeader } from "@/components/merchants/merchant-header";
import { MerchantDashboard } from "@/components/merchants/merchant-dashboard";

export const metadata: Metadata = {
  title: "Merchant Dashboard",
  description:
    "Manage open-box inventory, CPC bids, ad wallet, and sponsored listing performance.",
};

export default function MerchantDashboardPage() {
  return (
    <>
      <MerchantHeader action="exit" />
      <main className="min-h-dvh bg-canvas">
        <MerchantDashboard />
      </main>
    </>
  );
}
