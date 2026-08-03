import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { LiveProducts } from "@/components/live-products";
import { HowItWorks } from "@/components/how-it-works";
import { VipCta } from "@/components/vip-cta";
import { fetchEbayListings } from "@/lib/ebay";

export default async function Home() {
  const listings = await fetchEbayListings("laptop").catch(() => []);

  return (
    <>
      <Navbar />
      <main className="min-h-dvh bg-canvas">
        <Hero />

        <div id="deals" className="scroll-mt-24">
          <LiveProducts listings={listings} />
        </div>

        <HowItWorks />

        <div className="pt-20 sm:pt-24">
          <VipCta />
        </div>
      </main>
    </>
  );
}
