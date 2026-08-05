export type AccountUser = {
  name: string;
  email: string;
  initials: string;
  tier: "vip";
  /** ISO dates — formatted in UTC so server and client agree. */
  memberSince: string;
  renewsOn: string;
};

export const MOCK_USER: AccountUser = {
  name: "Alex Rivera",
  email: "alex.rivera@example.com",
  initials: "AR",
  tier: "vip",
  memberSince: "2025-03-14",
  renewsOn: "2026-08-28",
};

/* ------------------------------------------------------------------ */
/* Saved deals                                                         */
/* ------------------------------------------------------------------ */

export type SavedDeal = {
  productId: string;
  /** Alert fires when the listing drops to or below this. */
  targetPrice: number;
  sms: boolean;
  email: boolean;
  savedOn: string;
};

export const MOCK_SAVED_DEALS: SavedDeal[] = [
  {
    productId: "apple-mba-m2-16-512",
    targetPrice: 799,
    sms: true,
    email: true,
    savedOn: "2026-07-12",
  },
  {
    productId: "sony-a7-iv-body",
    targetPrice: 1750,
    sms: true,
    email: false,
    savedOn: "2026-07-19",
  },
  {
    productId: "sony-wh1000xm5",
    targetPrice: 249,
    sms: false,
    email: true,
    savedOn: "2026-07-24",
  },
  {
    productId: "sony-ps5-slim-disc",
    targetPrice: 349,
    sms: false,
    email: false,
    savedOn: "2026-07-29",
  },
];

// Defined alongside the catalog itself; re-exported so the account components
// that already import it from here keep working.
export { productById } from "@/lib/mock-products";

/* ------------------------------------------------------------------ */
/* AI Vision history                                                   */
/* ------------------------------------------------------------------ */

export type VisionScan = {
  id: string;
  /** What the model resolved the upload to. */
  identified: string;
  source: "screenshot" | "link";
  /** Original filename or hostname, shown under the thumbnail. */
  sourceLabel: string;
  scannedOn: string;
  matches: number;
  bestPrice: number;
  retailPrice: number;
  /** Comparisons the user explicitly kept. */
  saved: boolean;
};

export const MOCK_VISION_HISTORY: VisionScan[] = [
  {
    id: "scan-1042",
    identified: "Apple MacBook Air M2 16GB",
    source: "screenshot",
    sourceLabel: "bestbuy-macbook.png",
    scannedOn: "2026-07-30",
    matches: 3,
    bestPrice: 849,
    retailPrice: 1199,
    saved: true,
  },
  {
    id: "scan-1039",
    identified: "Sony Alpha a7 IV Body",
    source: "link",
    sourceLabel: "bestbuy.com",
    scannedOn: "2026-07-27",
    matches: 5,
    bestPrice: 1899,
    retailPrice: 2499,
    saved: true,
  },
  {
    id: "scan-1031",
    identified: "Bose QuietComfort Ultra",
    source: "screenshot",
    sourceLabel: "IMG_4417.jpg",
    scannedOn: "2026-07-21",
    matches: 2,
    bestPrice: 289,
    retailPrice: 429,
    saved: false,
  },
  {
    id: "scan-1024",
    identified: "LG C4 65\" OLED evo",
    source: "link",
    sourceLabel: "walmart.com",
    scannedOn: "2026-07-15",
    matches: 4,
    bestPrice: 1596,
    retailPrice: 2499,
    saved: false,
  },
];

/* ------------------------------------------------------------------ */

// Shared with the merchant portal; re-exported so existing imports still work.
export { formatDate } from "@/lib/utils";

