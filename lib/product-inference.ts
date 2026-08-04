/**
 * Product inference — turn free text, a retail URL, or an image filename into
 * a structured product guess, and synthesize the open-box offers we'd expect
 * to find for it.
 *
 * Two callers, one shape:
 *
 *  - `/api/vision` uses this as the deterministic fallback when
 *    `ANTHROPIC_API_KEY` is unset, and to fill gaps (estimated MSRP) that the
 *    model is instructed not to guess at.
 *  - The search bar's AI match card uses it when a query matches nothing in
 *    the catalog, so "Xbox Series X" still produces something actionable
 *    instead of a dead end.
 *
 * Everything here is pure and deterministic — same input, same output, on the
 * server and on the client. That is a hard requirement, not a preference: the
 * AI match card renders during hydration, and an `Math.random()` price would
 * mismatch between the two passes.
 */

import {
  RETAILERS,
  defaultWarranty,
  type CardCondition,
  type ProductCategory,
  type RetailerId,
} from "@/lib/catalog";
import { computeCashback, rateForRetailer } from "@/lib/cashback-rates";

/** Categories the catalog carries, plus a bucket for everything else. */
export type InferredCategory = ProductCategory | "other";

export type ParsedProduct = {
  /** False when the input carried no recognizable product signal at all. */
  identified: boolean;
  confidence: "high" | "medium" | "low";
  /** Best human-readable name we could reconstruct. */
  productName: string;
  brand: string | null;
  category: InferredCategory;
  categoryLabel: string;
  condition: CardCondition;
  /** USD. Read off the page when possible, otherwise a category estimate. */
  estimatedMsrp: number;
  msrpSource: "listed" | "estimated";
  /** A price literally present in the input, if there was one. */
  listedPrice: number | null;
  retailer: string | null;
  /** Terms to match this against inventory. */
  searchKeywords: string[];
  notes: string | null;
};

export type InferenceInput = {
  /** A pasted retail product URL. */
  url?: string | null;
  /** Free text: a search query, or the user's description of the upload. */
  text?: string | null;
  /** Uploaded filename — screenshots are often named after the product. */
  filename?: string | null;
};

/* ------------------------------------------------------------------ */
/* Lookup tables                                                       */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<InferredCategory, string> = {
  laptops: "Laptops",
  cameras: "Cameras",
  headphones: "Headphones",
  consoles: "Gaming Consoles",
  tvs: "TVs",
  appliances: "Appliances",
  other: "Electronics",
};

/**
 * Brand aliases → canonical brand. Aliases matter because product names rarely
 * carry the manufacturer: nobody writes "Microsoft Xbox Series X".
 */
const BRANDS: [pattern: string, brand: string][] = [
  ["macbook", "Apple"],
  ["airpods", "Apple"],
  ["ipad", "Apple"],
  ["iphone", "Apple"],
  ["imac", "Apple"],
  ["apple", "Apple"],
  ["xbox", "Microsoft"],
  ["surface", "Microsoft"],
  ["microsoft", "Microsoft"],
  ["playstation", "Sony"],
  ["ps5", "Sony"],
  ["ps4", "Sony"],
  ["bravia", "Sony"],
  ["sony", "Sony"],
  ["nintendo", "Nintendo"],
  ["switch", "Nintendo"],
  ["samsung", "Samsung"],
  ["galaxy", "Samsung"],
  ["lg", "LG"],
  ["tcl", "TCL"],
  ["hisense", "Hisense"],
  ["vizio", "Vizio"],
  ["roku", "Roku"],
  ["dell", "Dell"],
  ["alienware", "Dell"],
  ["hp", "HP"],
  ["lenovo", "Lenovo"],
  ["thinkpad", "Lenovo"],
  ["asus", "ASUS"],
  ["acer", "Acer"],
  ["razer", "Razer"],
  ["msi", "MSI"],
  ["framework", "Framework"],
  ["bose", "Bose"],
  ["sennheiser", "Sennheiser"],
  ["beats", "Beats"],
  ["jbl", "JBL"],
  ["anker", "Anker"],
  ["soundcore", "Anker"],
  ["canon", "Canon"],
  ["nikon", "Nikon"],
  ["fujifilm", "Fujifilm"],
  ["gopro", "GoPro"],
  ["dji", "DJI"],
  ["whirlpool", "Whirlpool"],
  ["maytag", "Maytag"],
  ["frigidaire", "Frigidaire"],
  ["kitchenaid", "KitchenAid"],
  ["bosch", "Bosch"],
  ["miele", "Miele"],
  ["speed queen", "Speed Queen"],
  ["dyson", "Dyson"],
  ["irobot", "iRobot"],
  ["roomba", "iRobot"],
  ["logitech", "Logitech"],
  ["steelseries", "SteelSeries"],
  ["google", "Google"],
  ["pixel", "Google"],
];

/**
 * Category detection plus a baseline US launch MSRP for that class of product.
 * Ordered most-specific first: "macbook pro" must win over the generic
 * "laptop" rule, and "washer dryer" over "washer".
 */
const SIGNATURES: {
  terms: string[];
  category: InferredCategory;
  /** Baseline MSRP in USD before brand/size adjustment. */
  msrp: number;
  /** Extra search terms this class of product should match on. */
  keywords: string[];
}[] = [
  // Consoles
  { terms: ["xbox series x"], category: "consoles", msrp: 499, keywords: ["xbox", "console"] },
  { terms: ["xbox series s"], category: "consoles", msrp: 299, keywords: ["xbox", "console"] },
  { terms: ["xbox"], category: "consoles", msrp: 499, keywords: ["xbox", "console"] },
  { terms: ["ps5 pro", "playstation 5 pro"], category: "consoles", msrp: 699, keywords: ["playstation", "console"] },
  { terms: ["ps5", "playstation"], category: "consoles", msrp: 499, keywords: ["playstation", "console"] },
  { terms: ["steam deck"], category: "consoles", msrp: 549, keywords: ["handheld", "console"] },
  { terms: ["switch oled"], category: "consoles", msrp: 349, keywords: ["nintendo", "console"] },
  { terms: ["switch", "nintendo"], category: "consoles", msrp: 299, keywords: ["nintendo", "console"] },

  // Appliances — before TVs so "washer" never falls through to electronics.
  { terms: ["washer dryer", "washer and dryer", "laundry pair"], category: "appliances", msrp: 1899, keywords: ["laundry", "washer", "dryer"] },
  { terms: ["washing machine", "washer"], category: "appliances", msrp: 999, keywords: ["laundry", "washing machine", "washer"] },
  { terms: ["dryer"], category: "appliances", msrp: 949, keywords: ["laundry", "dryer"] },
  { terms: ["dishwasher"], category: "appliances", msrp: 899, keywords: ["kitchen", "dishwasher"] },
  { terms: ["refrigerator", "fridge"], category: "appliances", msrp: 2199, keywords: ["kitchen", "refrigerator"] },
  { terms: ["freezer"], category: "appliances", msrp: 899, keywords: ["kitchen", "freezer"] },
  { terms: ["range", "oven", "cooktop", "stove"], category: "appliances", msrp: 1299, keywords: ["kitchen", "oven"] },
  { terms: ["microwave"], category: "appliances", msrp: 349, keywords: ["kitchen", "microwave"] },
  { terms: ["vacuum", "roomba"], category: "appliances", msrp: 549, keywords: ["vacuum", "floorcare"] },
  { terms: ["air fryer"], category: "appliances", msrp: 199, keywords: ["kitchen", "air fryer"] },

  // TVs
  { terms: ["oled tv", "oled"], category: "tvs", msrp: 1799, keywords: ["tv", "television", "oled"] },
  { terms: ["mini led", "neo qled"], category: "tvs", msrp: 1499, keywords: ["tv", "television", "mini led"] },
  { terms: ["qled"], category: "tvs", msrp: 1199, keywords: ["tv", "television", "qled"] },
  { terms: ["television", "smart tv", "4k tv", " tv"], category: "tvs", msrp: 899, keywords: ["tv", "television"] },
  { terms: ["monitor", "ultrawide"], category: "other", msrp: 649, keywords: ["monitor", "display"] },

  // Laptops
  { terms: ["macbook pro"], category: "laptops", msrp: 1999, keywords: ["laptop", "macbook", "apple"] },
  { terms: ["macbook air", "macbook"], category: "laptops", msrp: 1099, keywords: ["laptop", "macbook", "apple"] },
  { terms: ["gaming laptop"], category: "laptops", msrp: 1599, keywords: ["laptop", "gaming"] },
  { terms: ["chromebook"], category: "laptops", msrp: 399, keywords: ["laptop", "chromebook"] },
  { terms: ["thinkpad", "laptop", "notebook", "ultrabook"], category: "laptops", msrp: 1099, keywords: ["laptop", "notebook"] },

  // Audio
  { terms: ["airpods pro"], category: "headphones", msrp: 249, keywords: ["earbuds", "airpods", "noise cancelling"] },
  { terms: ["airpods max"], category: "headphones", msrp: 549, keywords: ["headphones", "noise cancelling"] },
  { terms: ["airpods", "earbuds"], category: "headphones", msrp: 179, keywords: ["earbuds", "wireless"] },
  { terms: ["soundbar"], category: "other", msrp: 599, keywords: ["soundbar", "home theater"] },
  { terms: ["headphones", "headphone", "headset"], category: "headphones", msrp: 349, keywords: ["headphones", "wireless"] },

  // Cameras
  { terms: ["mirrorless"], category: "cameras", msrp: 2199, keywords: ["camera", "mirrorless"] },
  { terms: ["dslr"], category: "cameras", msrp: 899, keywords: ["camera", "dslr"] },
  { terms: ["action camera", "gopro"], category: "cameras", msrp: 399, keywords: ["camera", "action camera"] },
  { terms: ["drone"], category: "other", msrp: 799, keywords: ["drone", "aerial"] },
  { terms: ["camera", "lens"], category: "cameras", msrp: 1099, keywords: ["camera", "photography"] },

  // Phones / tablets fall into "other" — real inventory doesn't carry them yet.
  { terms: ["iphone", "galaxy s", "pixel", "smartphone", "phone"], category: "other", msrp: 899, keywords: ["phone", "smartphone"] },
  { terms: ["ipad", "tablet"], category: "other", msrp: 599, keywords: ["tablet"] },
];

/** Premium marques carry a higher sticker than the category baseline. */
const BRAND_MULTIPLIERS: Record<string, number> = {
  Apple: 1.25,
  Sony: 1.1,
  Bose: 1.1,
  Miele: 1.5,
  Bosch: 1.15,
  "Speed Queen": 1.3,
  Dyson: 1.2,
  LG: 1.05,
  Samsung: 1.05,
  TCL: 0.7,
  Hisense: 0.7,
  Vizio: 0.65,
  Acer: 0.85,
};

/** Screen-size anchors for TVs and monitors, in USD at the class baseline. */
const TV_SIZE_MSRP: [inches: number, msrp: number][] = [
  [32, 249],
  [43, 399],
  [50, 549],
  [55, 749],
  [65, 1099],
  [75, 1699],
  [83, 3299],
  [98, 5999],
];

const RETAILER_HOSTS: [fragment: string, label: string, id: RetailerId | null][] = [
  ["bestbuy", "Best Buy", "best-buy"],
  ["walmart", "Walmart", "walmart"],
  ["amazon", "Amazon", "amazon-warehouse"],
  ["ebay", "eBay", "ebay"],
  ["newegg", "Newegg", "newegg"],
  ["backmarket", "Back Market", "back-market"],
  ["gamestop", "GameStop", "gamestop"],
  ["adorama", "Adorama", "adorama"],
  ["target", "Target", null],
  ["costco", "Costco", null],
  ["homedepot", "The Home Depot", null],
  ["lowes", "Lowe's", null],
  ["apple", "Apple", null],
  ["samsung", "Samsung", null],
  ["bhphotovideo", "B&H Photo", null],
];

/** Typical open-box discount off MSRP, by grade. */
const DISCOUNT: Record<CardCondition, number> = {
  "open-box-excellent": 0.3,
  "like-new": 0.26,
  "certified-refurbished": 0.35,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * FNV-1a. Used only to vary synthesized prices per query so three offers don't
 * all land on identical round numbers — deterministic, so server and client
 * agree.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h);
}

const lower = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

/**
 * Words that stay uppercase in a product name. Anything containing a digit
 * (4K, C4, 1TB, WM4000HWA) is handled separately — this list is for the
 * letters-only acronyms, which can't be detected by shape.
 */
const ACRONYMS = new Set([
  "tv",
  "uhd",
  "hd",
  "led",
  "lcd",
  "hdr",
  "anc",
  "ssd",
  "hdd",
  "ram",
  "cpu",
  "gpu",
  "usb",
  "pc",
  "ai",
  "qd",
  "oled",
  "qled",
  "nvme",
  "hdmi",
  "dslr",
]);

/** Connectors that stay lowercase unless they lead the name. */
const MINOR = new Set(["and", "the", "for", "with", "in", "of", "to", "by"]);

/**
 * Words with irregular casing that plain title-casing would mangle — every
 * canonical brand in the table above (LG, GoPro, iRobot, ASUS) plus the
 * product lines whose casing is part of the trademark.
 */
const PROPER_CASE = new Map<string, string>([
  ...BRANDS.map(([, brand]) => [brand.toLowerCase(), brand] as [string, string]),
  ["macbook", "MacBook"],
  ["airpods", "AirPods"],
  ["iphone", "iPhone"],
  ["ipad", "iPad"],
  ["imac", "iMac"],
  ["playstation", "PlayStation"],
  ["thinkpad", "ThinkPad"],
  ["quietcomfort", "QuietComfort"],
  ["bravia", "BRAVIA"],
  ["roomba", "Roomba"],
]);

const titleCase = (s: string) =>
  s
    .split(" ")
    .filter(Boolean)
    .map((raw, i) => {
      const w = raw.toLowerCase();
      // Model numbers read as written: 4K, C4, 1TB, WM4000HWA.
      if (/\d/.test(w)) return raw.toUpperCase();
      if (ACRONYMS.has(w)) return w.toUpperCase();
      const proper = PROPER_CASE.get(w);
      if (proper) return proper;
      if (MINOR.has(w) && i > 0) return w;
      return w[0].toUpperCase() + w.slice(1);
    })
    .join(" ");

/**
 * Words a screenshot filename picks up from the OS or the download, which
 * would otherwise end up in the product name ("Samsung Dryer Screenshot").
 */
const FILENAME_NOISE = new Set([
  "screenshot",
  "screen",
  "shot",
  "img",
  "image",
  "photo",
  "pic",
  "capture",
  "untitled",
  "download",
  "downloaded",
  "copy",
  "final",
  "new",
  "at",
  "pm",
  "am",
]);

/** Pull the descriptive slug out of a retail product URL. */
function slugFromUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const segments = parsed.pathname
    .split("/")
    .map((s) => decodeURIComponent(s))
    // Drop routing noise and SKU segments — "site", "p", "6578021.p", "dp".
    .filter((s) => s.length > 3 && /[a-z]{3}/i.test(s) && !/^\d+\.?[a-z]?$/.test(s));

  if (segments.length === 0) return null;

  // The longest hyphenated segment is almost always the product name.
  const best = segments.sort(
    (a, b) => b.split(/[-_+]/).length - a.split(/[-_+]/).length,
  )[0];

  const words = best
    .replace(/\.(html?|p|aspx)$/i, "")
    .split(/[-_+]/)
    .filter((w) => w.length > 0 && !/^\d{5,}$/.test(w));

  return words.length >= 2 ? words.join(" ") : null;
}

function retailerFromUrl(raw: string): { label: string; id: RetailerId | null } | null {
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
  const found = RETAILER_HOSTS.find(([fragment]) => host.includes(fragment));
  return found ? { label: found[1], id: found[2] } : null;
}

function conditionFrom(haystack: string): CardCondition {
  if (/\b(certified\s+)?refurb|renewed|reconditioned\b/.test(haystack)) {
    return "certified-refurbished";
  }
  if (/\blike\s?new|mint|excellent condition\b/.test(haystack)) return "like-new";
  return "open-box-excellent";
}

/** First plausible USD price in the text — `$1,299.99`, `1299 usd`, `$899`. */
function priceFrom(haystack: string): number | null {
  const match = /\$\s?([0-9][0-9,]{1,7}(?:\.[0-9]{2})?)/.exec(haystack);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Screen size in inches, e.g. `65"`, `65-inch`, `65 in`. */
function inchesFrom(haystack: string): number | null {
  const match = /\b(\d{2})\s?(?:inch|in\b|")/.exec(haystack);
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 20 && value <= 110 ? value : null;
}

/* ------------------------------------------------------------------ */
/* Inference                                                           */
/* ------------------------------------------------------------------ */

/**
 * Best-effort structured read of whatever the shopper handed us. Never throws
 * and never returns null — an unrecognizable input comes back with
 * `identified: false` and a low-confidence generic estimate, which the UI
 * renders as "we couldn't place this" rather than a wrong answer.
 */
export function inferProduct(input: InferenceInput): ParsedProduct {
  const url = input.url?.trim() || null;
  const text = input.text?.trim() || null;
  const filename = input.filename?.trim() || null;

  const slug = url ? slugFromUrl(url) : null;
  // Filenames like `xbox-series-x-bestbuy.png` read the same way as a slug,
  // once the capture-tool boilerplate is stripped.
  const fileWords =
    filename
      ?.replace(/\.[a-z0-9]{2,4}$/i, "")
      .replace(/[-_.]+/g, " ")
      .split(/\s+/)
      .filter((w) => w && !FILENAME_NOISE.has(w.toLowerCase()) && !/^\d+$/.test(w))
      .join(" ") || null;

  // A URL slug is the most authoritative name available — it's the retailer's
  // own product title. Otherwise take whichever of the user's text and the
  // filename is more descriptive; "used dryer" loses to
  // "samsung-electric-dryer.png".
  const wordCount = (s: string | null) => (s ? s.trim().split(/\s+/).length : 0);
  const nameSource =
    slug ?? (wordCount(fileWords) > wordCount(text) ? fileWords : text) ?? "";
  const haystack = lower([text, slug, fileWords, url].filter(Boolean).join(" "));

  const brand =
    BRANDS.find(([pattern]) => haystack.includes(` ${pattern}`))?.[1] ?? null;

  const signature = SIGNATURES.find((s) =>
    s.terms.some((t) => haystack.includes(t.startsWith(" ") ? t : ` ${t}`)),
  );

  const category: InferredCategory = signature?.category ?? "other";
  const inches = inchesFrom(haystack);
  const listedPrice = priceFrom(haystack);

  // MSRP: prefer the size anchor for screens, then the category baseline,
  // then adjust for the brand's usual position in that class.
  let msrp = signature?.msrp ?? 499;
  if ((category === "tvs" || haystack.includes("monitor")) && inches) {
    const anchor =
      TV_SIZE_MSRP.find(([size]) => inches <= size) ??
      TV_SIZE_MSRP[TV_SIZE_MSRP.length - 1];
    msrp = anchor[1];
    if (haystack.includes("oled")) msrp = Math.round(msrp * 1.6);
    else if (haystack.includes("mini led") || haystack.includes("neo qled")) {
      msrp = Math.round(msrp * 1.35);
    } else if (haystack.includes("qled")) msrp = Math.round(msrp * 1.15);
  }
  if (brand && BRAND_MULTIPLIERS[brand]) {
    msrp = Math.round(msrp * BRAND_MULTIPLIERS[brand]);
  }
  // Round to a retail-looking number.
  msrp = Math.max(49, Math.round(msrp / 10) * 10 - 1);

  const retailer = url ? retailerFromUrl(url) : null;
  const condition = conditionFrom(haystack);

  const rawName = nameSource || (brand ? `${brand} product` : "Unidentified product");
  const productName = titleCase(rawName.replace(/\s+/g, " ").slice(0, 80)).trim();

  const identified = Boolean(signature || brand);

  const keywords = Array.from(
    new Set(
      [
        ...(brand ? [brand.toLowerCase()] : []),
        ...(signature?.keywords ?? []),
        ...lower(rawName)
          .split(" ")
          .filter((w) => w.length > 2),
      ].filter(Boolean),
    ),
  ).slice(0, 8);

  return {
    identified,
    confidence: signature && brand ? "high" : signature || brand ? "medium" : "low",
    productName,
    brand,
    category,
    categoryLabel: CATEGORY_LABELS[category],
    condition,
    estimatedMsrp: listedPrice && listedPrice > msrp ? listedPrice : msrp,
    msrpSource: listedPrice && listedPrice > msrp ? "listed" : "estimated",
    listedPrice,
    retailer: retailer?.label ?? null,
    searchKeywords: keywords,
    notes: identified
      ? null
      : "No recognizable brand or product class in the input — the estimate below is a generic open-box baseline.",
  };
}

/* ------------------------------------------------------------------ */
/* Synthesized open-box offers                                         */
/* ------------------------------------------------------------------ */

export type AiMatchOffer = {
  id: string;
  merchant: RetailerId;
  merchantLabel: string;
  condition: CardCondition;
  warranty: string;
  price: number;
  shipping: number;
  cashback: number;
  stock: string;
  dealUrl: string;
};

/** Retailers we'd realistically source each class of product from. */
const SOURCING: Record<InferredCategory, RetailerId[]> = {
  tvs: ["best-buy", "walmart", "amazon-warehouse", "ebay"],
  appliances: ["best-buy", "walmart", "ebay", "amazon-warehouse"],
  consoles: ["gamestop", "best-buy", "walmart", "ebay"],
  laptops: ["best-buy", "amazon-warehouse", "back-market", "newegg"],
  headphones: ["best-buy", "amazon-warehouse", "ebay", "back-market"],
  cameras: ["adorama", "best-buy", "ebay", "amazon-warehouse"],
  other: ["amazon-warehouse", "ebay", "best-buy", "walmart"],
};

/**
 * Three plausible open-box listings for a product we don't stock yet.
 *
 * These are *projections*, not live inventory — the caller is responsible for
 * labelling them as such. They exist so a shopper searching for something
 * outside the catalog sees the shape of the deal we'd find rather than an
 * empty state.
 */
export function buildAiMatchOffers(parsed: ParsedProduct): AiMatchOffer[] {
  const seed = hash(`${parsed.productName}|${parsed.category}|${parsed.estimatedMsrp}`);
  const merchants = SOURCING[parsed.category];

  // Rotate the merchant list per product so every AI card isn't Best Buy-first.
  const rotation = seed % merchants.length;
  const grades: CardCondition[] = [
    parsed.condition,
    parsed.condition === "certified-refurbished" ? "open-box-excellent" : "certified-refurbished",
    "like-new",
  ];

  return grades
    .map((condition, i) => {
      const merchant = merchants[(rotation + i) % merchants.length];
      // Spread the three offers across a realistic band: the headline grade
      // leads, the others land 4–11% above it.
      const spread = i === 0 ? 0 : 0.04 + ((seed >> (i * 3)) % 8) / 100;
      const price = Math.round(
        parsed.estimatedMsrp * (1 - DISCOUNT[condition]) * (1 + spread),
      );
      const shipping = i === 2 ? Math.round(parsed.estimatedMsrp * 0.03) : 0;

      return {
        id: `ai-${parsed.category}-${merchant}-${i}`,
        merchant,
        merchantLabel: RETAILERS[merchant].label,
        condition,
        warranty: defaultWarranty(parsed.brand ?? "Manufacturer", condition),
        price,
        shipping,
        cashback: computeCashback(price, rateForRetailer(merchant)),
        stock: i === 0 ? "Checking stock" : "Availability varies",
        dealUrl: RETAILERS[merchant].home,
      } satisfies AiMatchOffer;
    })
    .sort((a, b) => a.price + a.shipping - (b.price + b.shipping));
}
