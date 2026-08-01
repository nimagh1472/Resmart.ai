import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { TrendingDeals } from "@/components/trending-deals";
import { HowItWorks } from "@/components/how-it-works";
import { VipCta } from "@/components/vip-cta";
import { MOCK_PRODUCTS } from "@/lib/mock-products";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="min-h-dvh bg-canvas">
        <Hero />

        <div id="deals" className="scroll-mt-24">
          <TrendingDeals products={MOCK_PRODUCTS} />
        </div>

        <HowItWorks />

        <div className="pt-20 sm:pt-24">
          <VipCta />
        </div>
      </main>
    </>
  );
}
