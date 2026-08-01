import type { CardCondition } from "@/lib/catalog";

/* ------------------------------------------------------------------ */
/* Monetization constants                                              */
/* ------------------------------------------------------------------ */

/** Flat platform commission taken on completed sales. */
export const COMMISSION_RATE = 0.1;

/** Optional CPC boost bid range, USD per click. */
export const CPC_MIN = 0.25;
export const CPC_MAX = 1.5;
export const CPC_STEP = 0.05;

/* ------------------------------------------------------------------ */
/* Merchant account                                                    */
/* ------------------------------------------------------------------ */

export type MerchantStatus = "pending" | "approved" | "suspended";

export type MerchantProfile = {
  businessName: string;
  status: MerchantStatus;
  /** ISO date the application was submitted. */
  submittedOn: string;
  reviewEtaHours: number;
};

export const MOCK_MERCHANT: MerchantProfile = {
  businessName: "Northgate Electronics",
  status: "pending",
  submittedOn: "2026-07-30",
  reviewEtaHours: 48,
};

/** Listings only reach public search once the merchant is approved. */
export const canPublish = (status: MerchantStatus) => status === "approved";

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

export type MerchantListing = {
  id: string;
  title: string;
  condition: CardCondition;
  /** Manufacturer's suggested price — the reference the discount is cut from. */
  msrp: number;
  /** The open-box price buyers pay. */
  price: number;
  stock: number;
  url: string;
  /** CPC boost on/off. Independent of the bid, so the bid survives a pause. */
  boostEnabled: boolean;
  cpcBid: number;
  impressions: number;
  clicks: number;
  unitsSold: number;
};

export const MOCK_LISTINGS: MerchantListing[] = [
  {
    id: "lst-8801",
    title: 'Apple MacBook Air 13" M2 · 16GB / 512GB',
    condition: "open-box-excellent",
    msrp: 1199,
    price: 849,
    stock: 4,
    url: "https://www.bestbuy.com/site/macbook-air-m2",
    boostEnabled: true,
    cpcBid: 1.35,
    impressions: 184_920,
    clicks: 5_128,
    unitsSold: 62,
  },
  {
    id: "lst-8802",
    title: "Sony Alpha a7 IV Mirrorless · Body Only",
    condition: "open-box-excellent",
    msrp: 2499,
    price: 1899,
    stock: 3,
    url: "https://www.bestbuy.com/site/sony-a7-iv",
    boostEnabled: true,
    cpcBid: 1.5,
    impressions: 96_450,
    clicks: 2_411,
    unitsSold: 18,
  },
  {
    id: "lst-8803",
    title: "Dell XPS 15 9530 · i7 / 32GB / RTX 4060",
    condition: "certified-refurbished",
    msrp: 2099,
    price: 1399,
    stock: 2,
    url: "https://www.dell.com/outlet/xps-15",
    boostEnabled: true,
    cpcBid: 1.1,
    impressions: 142_308,
    clicks: 3_016,
    unitsSold: 27,
  },
  {
    id: "lst-8804",
    title: "Sony WH-1000XM5 Noise Cancelling",
    condition: "open-box-excellent",
    msrp: 399,
    price: 268,
    stock: 11,
    url: "https://www.bestbuy.com/site/wh-1000xm5",
    boostEnabled: true,
    cpcBid: 0.75,
    impressions: 231_004,
    clicks: 9_842,
    unitsSold: 184,
  },
  {
    id: "lst-8805",
    title: "Xbox Series X · 1TB",
    condition: "certified-refurbished",
    msrp: 499,
    price: 359,
    stock: 0,
    url: "https://www.bestbuy.com/site/xbox-series-x",
    boostEnabled: false,
    cpcBid: 0.4,
    impressions: 57_612,
    clicks: 1_004,
    unitsSold: 41,
  },
];

/* ------------------------------------------------------------------ */
/* Wallet                                                              */
/* ------------------------------------------------------------------ */

/**
 * Only prepaid ad-spend state lives here. Sales revenue and commission are
 * derived from the listings so the wallet can't drift from the inventory.
 */
export type MerchantWallet = {
  adSpendBalance: number;
  autoRecharge: boolean;
  rechargeThreshold: number;
  rechargeAmount: number;
  adSpendToday: number;
  /** Commission already settled; the rest of what's earned is owed. */
  commissionsSettled: number;
  /** ISO date of the next payout/settlement run. */
  nextSettlementOn: string;
};

export const MOCK_WALLET: MerchantWallet = {
  adSpendBalance: 1284.5,
  autoRecharge: true,
  rechargeThreshold: 250,
  rechargeAmount: 500,
  adSpendToday: 68.4,
  commissionsSettled: 9620,
  nextSettlementOn: "2026-08-15",
};

/* ------------------------------------------------------------------ */
/* Derived metrics                                                     */
/* ------------------------------------------------------------------ */

/** Click-through rate as a fraction (0–1). */
export const ctr = (l: Pick<MerchantListing, "impressions" | "clicks">) =>
  l.impressions === 0 ? 0 : l.clicks / l.impressions;

/** Ad spend to date. Only boosted listings accrue clicks that bill. */
export const adSpend = (l: Pick<MerchantListing, "clicks" | "cpcBid">) =>
  l.clicks * l.cpcBid;

/** Gross sales revenue for a listing. */
export const revenue = (l: Pick<MerchantListing, "unitsSold" | "price">) =>
  l.unitsSold * l.price;

/** Platform commission owed on a listing's sales. */
export const commission = (l: Pick<MerchantListing, "unitsSold" | "price">) =>
  revenue(l) * COMMISSION_RATE;

/** What the merchant keeps on one unit after commission. */
export const netPerUnit = (price: number) => price * (1 - COMMISSION_RATE);

/**
 * Rough auction forecast shown beside the bid slider. Deliberately a simple
 * curve — the real number comes from the live auction, not the client.
 */
export function forecastForBid(bid: number) {
  const t = (bid - CPC_MIN) / (CPC_MAX - CPC_MIN); // 0–1
  const dailyClicks = Math.round(6 + t * 40);
  return {
    dailyClicks,
    dailySpend: dailyClicks * bid,
    position: bid < 0.6 ? "#4–6" : bid < 1.05 ? "#2–3" : "#1",
  };
}
