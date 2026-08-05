/* ------------------------------------------------------------------ */
/* Platform settings                                                   */
/* ------------------------------------------------------------------ */

export type PlatformSettings = {
  /** VIP subscription price, USD per month. */
  vipFee: number;
  /** Platform commission on completed merchant sales, as a fraction. */
  commissionRate: number;
  /** Flat merchant membership fee, USD per month, billed regardless of sales volume. */
  merchantSubscriptionFee: number;
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  vipFee: 14.99,
  commissionRate: 0.1,
  merchantSubscriptionFee: 79.99,
};

export const SETTING_BOUNDS = {
  vipFee: { min: 4.99, max: 49.99, step: 1 },
  commissionRate: { min: 0.05, max: 0.25, step: 0.005 },
  merchantSubscriptionFee: { min: 19.99, max: 199.99, step: 5 },
} as const;

/* ------------------------------------------------------------------ */
/* Financials                                                          */
/* ------------------------------------------------------------------ */

/**
 * Period actuals. `recorded*` are the rates that were in force while the
 * money was earned — kept separate from the editable settings so changing a
 * rate today doesn't retroactively rewrite last month's books.
 */
export type PlatformFinancials = {
  periodLabel: string;
  gmv: number;
  vipSubscribers: number;
  merchantSubscribers: number;
  cpcAdRevenue: number;
  recordedCommissionRate: number;
  recordedVipFee: number;
  recordedMerchantSubscriptionFee: number;
  /** Period-over-period change, as a fraction. */
  deltas: {
    gmv: number;
    commission: number;
    vip: number;
    cpc: number;
    merchantSubscription: number;
  };
};

export const MOCK_FINANCIALS: PlatformFinancials = {
  periodLabel: "Month to date · Aug 2026",
  gmv: 4_182_940,
  vipSubscribers: 34_182,
  merchantSubscribers: 2_614,
  cpcAdRevenue: 186_420,
  recordedCommissionRate: 0.1,
  recordedVipFee: 14.99,
  recordedMerchantSubscriptionFee: 79.99,
  deltas: { gmv: 0.184, commission: 0.184, vip: 0.092, cpc: 0.231, merchantSubscription: 0.061 },
};

/** Derives every headline figure from the period's recorded rates. */
export function computeFinancials(f: PlatformFinancials) {
  const salesCommission = f.gmv * f.recordedCommissionRate;
  const vipRevenue = f.vipSubscribers * f.recordedVipFee;
  const merchantSubscriptionRevenue =
    f.merchantSubscribers * f.recordedMerchantSubscriptionFee;
  return {
    salesCommission,
    vipRevenue,
    merchantSubscriptionRevenue,
    grossRevenue:
      salesCommission + vipRevenue + f.cpcAdRevenue + merchantSubscriptionRevenue,
    netRevenue:
      salesCommission + vipRevenue + f.cpcAdRevenue + merchantSubscriptionRevenue,
  };
}

/**
 * Monthly impact of moving from the live settings to pending ones.
 * Applied to the current period's volumes — a forecast, not a restatement.
 */
export function projectSettingsImpact(
  f: PlatformFinancials,
  next: PlatformSettings,
) {
  const commission = f.gmv * (next.commissionRate - f.recordedCommissionRate);
  const vip = f.vipSubscribers * (next.vipFee - f.recordedVipFee);
  const merchantSubscription =
    f.merchantSubscribers *
    (next.merchantSubscriptionFee - f.recordedMerchantSubscriptionFee);
  return {
    commission,
    vip,
    merchantSubscription,
    net: commission + vip + merchantSubscription,
  };
}

/* ------------------------------------------------------------------ */
/* Merchant approval queue                                             */
/* ------------------------------------------------------------------ */

export type DocumentStatus = "verified" | "pending" | "missing" | "rejected";

export type MerchantApplication = {
  id: string;
  businessName: string;
  contactEmail: string;
  category: string;
  submittedOn: string;
  listingsQueued: number;
  documents: {
    businessLicense: DocumentStatus;
    taxId: DocumentStatus;
    resellerCert: DocumentStatus;
  };
};

export const DOCUMENT_LABELS: Record<
  keyof MerchantApplication["documents"],
  string
> = {
  businessLicense: "Business license",
  taxId: "Tax ID",
  resellerCert: "Reseller cert",
};

/** Approval is blocked until every document is verified or still in review. */
export const isApprovable = (app: MerchantApplication) =>
  Object.values(app.documents).every(
    (d) => d === "verified" || d === "pending",
  );

export const MOCK_APPLICATIONS: MerchantApplication[] = [
  {
    id: "app-3301",
    businessName: "Northgate Electronics",
    contactEmail: "ops@northgate-electronics.com",
    category: "Laptops · Consoles",
    submittedOn: "2026-07-30",
    listingsQueued: 42,
    documents: {
      businessLicense: "verified",
      taxId: "verified",
      resellerCert: "verified",
    },
  },
  {
    id: "app-3302",
    businessName: "Cascade Camera Exchange",
    contactEmail: "hello@cascadecamera.co",
    category: "Cameras",
    submittedOn: "2026-07-29",
    listingsQueued: 118,
    documents: {
      businessLicense: "verified",
      taxId: "pending",
      resellerCert: "verified",
    },
  },
  {
    id: "app-3303",
    businessName: "Bayline Audio Outlet",
    contactEmail: "accounts@baylineaudio.com",
    category: "Headphones",
    submittedOn: "2026-07-27",
    listingsQueued: 9,
    documents: {
      businessLicense: "verified",
      taxId: "missing",
      resellerCert: "pending",
    },
  },
  {
    id: "app-3304",
    businessName: "TriState Refurb Partners",
    contactEmail: "partners@tristaterefurb.net",
    category: "Laptops",
    submittedOn: "2026-07-24",
    listingsQueued: 267,
    documents: {
      businessLicense: "verified",
      taxId: "verified",
      resellerCert: "pending",
    },
  },
  {
    id: "app-3305",
    businessName: "Pixel Peak Trading",
    contactEmail: "admin@pixelpeaktrading.biz",
    category: "Consoles",
    submittedOn: "2026-07-22",
    listingsQueued: 31,
    documents: {
      businessLicense: "rejected",
      taxId: "missing",
      resellerCert: "missing",
    },
  },
];

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export type PlatformUser = {
  id: string;
  name: string;
  email: string;
  joinedOn: string;
  isVip: boolean;
  lifetimeSpend: number;
  status: "active" | "suspended";
  /** Set when automated abuse checks flag the account. */
  flagReason?: string;
};

export const MOCK_USERS: PlatformUser[] = [
  {
    id: "usr-4829",
    name: "Alex Rivera",
    email: "alex.rivera@example.com",
    joinedOn: "2025-03-14",
    isVip: true,
    lifetimeSpend: 12_482.4,
    status: "active",
  },
  {
    id: "usr-1174",
    name: "Priya Raman",
    email: "priya.raman@example.com",
    joinedOn: "2025-06-02",
    isVip: true,
    lifetimeSpend: 8_940.0,
    status: "active",
  },
  {
    id: "usr-9063",
    name: "Marcus Bell",
    email: "m.bell@example.com",
    joinedOn: "2026-01-19",
    isVip: false,
    lifetimeSpend: 1_204.5,
    status: "active",
  },
  {
    id: "usr-2510",
    name: "Dana Whitfield",
    email: "dana.w@example.com",
    joinedOn: "2025-11-08",
    isVip: true,
    lifetimeSpend: 24_118.9,
    status: "active",
  },
  {
    id: "usr-7742",
    name: "Kai Oyelaran",
    email: "kai.o@example.com",
    joinedOn: "2026-04-30",
    isVip: false,
    lifetimeSpend: 318.0,
    status: "suspended",
    flagReason: "14 disputed charges on refunded orders",
  },
  {
    id: "usr-6018",
    name: "Sofia Klein",
    email: "sofia.klein@example.com",
    joinedOn: "2026-02-11",
    isVip: true,
    lifetimeSpend: 5_602.75,
    status: "active",
    flagReason: "Billing method changed 4× this month",
  },
];

/* ------------------------------------------------------------------ */
/* Listing moderation                                                  */
/* ------------------------------------------------------------------ */

export type FlagReason =
  | "not-open-box"
  | "price-manipulation"
  | "counterfeit-suspected"
  | "broken-link";

export const FLAG_LABELS: Record<FlagReason, string> = {
  "not-open-box": "Not open-box",
  "price-manipulation": "Inflated MSRP",
  "counterfeit-suspected": "Counterfeit suspected",
  "broken-link": "Dead product link",
};

export type FlaggedListing = {
  id: string;
  title: string;
  merchant: string;
  msrp: number;
  price: number;
  statedCondition: string;
  reason: FlagReason;
  reports: number;
  /** True when the AI grader raised it rather than a human report. */
  autoFlagged: boolean;
  reportedOn: string;
  detail: string;
};

export const MOCK_FLAGGED: FlaggedListing[] = [
  {
    id: "lst-99120",
    title: "Apple iPhone 15 Pro 256GB — Sealed Retail Box",
    merchant: "Pixel Peak Trading",
    msrp: 1099,
    price: 1049,
    statedCondition: "Open-Box Excellent",
    reason: "not-open-box",
    reports: 7,
    autoFlagged: true,
    reportedOn: "2026-07-31",
    detail:
      "Listing images show factory seal intact. Brand-new stock is not eligible for the open-box index.",
  },
  {
    id: "lst-99087",
    title: 'Samsung 55" QLED 4K Smart TV',
    merchant: "Bayline Audio Outlet",
    msrp: 2199,
    price: 899,
    statedCondition: "Certified Refurbished",
    reason: "price-manipulation",
    reports: 3,
    autoFlagged: true,
    reportedOn: "2026-07-30",
    detail:
      "Stated MSRP is $2,199; manufacturer list price is $1,099. Discount percentage is overstated ~2×.",
  },
  {
    id: "lst-98954",
    title: "AirPods Pro 2 (USB-C) — Grade A",
    merchant: "TriState Refurb Partners",
    msrp: 249,
    price: 79,
    statedCondition: "Like New",
    reason: "counterfeit-suspected",
    reports: 12,
    autoFlagged: false,
    reportedOn: "2026-07-28",
    detail:
      "Serial numbers in listing photos do not resolve against Apple's registry. Price is 68% below market floor.",
  },
  {
    id: "lst-98801",
    title: "Dell UltraSharp U2723QE 27\" Monitor",
    merchant: "Cascade Camera Exchange",
    msrp: 619,
    price: 388,
    statedCondition: "Open-Box Excellent",
    reason: "broken-link",
    reports: 2,
    autoFlagged: true,
    reportedOn: "2026-07-26",
    detail: "Destination URL has returned 404 for 6 consecutive crawls.",
  },
];
