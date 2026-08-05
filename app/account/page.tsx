import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { AccountHeader } from "@/components/account/account-header";
import { AccountTabs } from "@/components/account/account-tabs";
import { SubscriptionSection } from "@/components/account/subscription-section";
import { MOCK_USER } from "@/lib/mock-account";

export const metadata: Metadata = {
  title: "Your Account",
  description:
    "Manage your VIP membership, saved deals, and AI Vision history.",
};

export default function AccountPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-dvh bg-canvas">
        <div className="px-gutter mx-auto flex max-w-7xl flex-col gap-6 py-8">
          <AccountHeader user={MOCK_USER} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="order-2 min-w-0 lg:order-1">
              <AccountTabs />
            </div>

            <div className="order-1 flex flex-col gap-6 lg:order-2">
              <SubscriptionSection user={MOCK_USER} />
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Demo data. Alerts and saved items reset on reload.
          </p>
        </div>
      </main>
    </>
  );
}
