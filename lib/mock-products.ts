import type { Product, ProductCategory } from "@/components/ProductCard";
import {
  RETAILERS,
  defaultWarranty,
  sortOffersByValue,
  type CardCondition,
  type MerchantOffer,
  type RetailerId,
} from "@/lib/catalog";

/** VIP wallet rate — every mock cashback figure is derived from it. */
export const CASHBACK_RATE = 0.03;

const cashback = (price: number) =>
  Math.round(price * CASHBACK_RATE * 100) / 100;

/**
 * Deterministic 90-day series — no RNG, so server and client render the same
 * sparkline and hydration stays clean.
 */
function priceSeries(start: number, end: number, seed: number): number[] {
  return Array.from({ length: 90 }, (_, i) => {
    const t = i / 89;
    const drift = start + (end - start) * t;
    const wobble =
      Math.sin(i * 0.31 + seed) * (start * 0.012) +
      Math.sin(i * 0.11 + seed * 2) * (start * 0.008);
    return Math.round(drift + wobble);
  });
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  laptops: "Laptops",
  cameras: "Cameras",
  headphones: "Headphones",
  consoles: "Gaming Consoles",
  tvs: "TVs",
  appliances: "Appliances",
};

/**
 * A competing merchant's listing, expressed relative to the headline offer so
 * the fixtures stay readable. Several are deliberately cheaper on the sticker
 * but worse once shipping and cashback are counted — that's the case the
 * comparison table exists to make visible.
 */
type OfferSeed = {
  merchant: RetailerId;
  /** Added to the headline price. Negative = cheaper sticker. */
  delta: number;
  /** Defaults to the headline condition. */
  condition?: CardCondition;
  /** Flat shipping; omitted means free. */
  shipping?: number;
  /** Overrides the grade's implied coverage. */
  warranty?: string;
  stock?: string;
  returns?: string;
};

type Seed = Omit<
  Product,
  "cashback" | "priceHistory" | "offers" | "specs"
> & {
  /** [90 days ago, today] for the trend line. */
  trend: [number, number];
  /** [label, value] pairs for the product page's spec table. */
  specs: [string, string][];
  /** Merchants beyond the headline listing carried in the fields above. */
  competitors: OfferSeed[];
};

// `satisfies` rather than an annotation so the ids stay literal types — that's
// what makes SEARCH_COPY below exhaustive-checked against the catalog.
const SEEDS = [
  /* Laptops -------------------------------------------------------- */
  {
    id: "apple-mba-m2-16-512",
    brand: "Apple",
    model: 'MacBook Air 13" M2 · 16GB / 512GB',
    category: "laptops",
    retailer: "best-buy",
    condition: "open-box-excellent",
    msrp: 1199,
    price: 849,
    trend: [969, 849],
    dealUrl: "https://www.bestbuy.com/",
    inStock: "4 in stock",
    specs: [
      ["Display", '13.6" Liquid Retina · 2560×1664'],
      ["Chip", "Apple M2 · 8-core CPU / 10-core GPU"],
      ["Memory", "16GB unified"],
      ["Storage", "512GB SSD"],
      ["Battery", "Up to 18 hours"],
    ],
    competitors: [
      {
        merchant: "amazon-warehouse",
        condition: "certified-refurbished",
        delta: 36,
        stock: "2 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "back-market",
        condition: "like-new",
        delta: -20,
        shipping: 25,
        warranty: "1-Year Back Market Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
      {
        merchant: "ebay",
        delta: 55,
        stock: "1 in stock",
        returns: "14-day returns",
      },
    ],
  },
  {
    id: "dell-xps-15-9530",
    brand: "Dell",
    model: "XPS 15 9530 · i7 / 32GB / RTX 4060",
    category: "laptops",
    retailer: "ebay",
    condition: "certified-refurbished",
    msrp: 2099,
    price: 1399,
    trend: [1549, 1399],
    dealUrl: "https://www.ebay.com/",
    inStock: "2 in stock",
    specs: [
      ["Display", '15.6" FHD+ InfinityEdge · 500 nits'],
      ["Processor", "Intel Core i7-13700H"],
      ["Graphics", "NVIDIA GeForce RTX 4060 8GB"],
      ["Memory", "32GB DDR5-4800"],
      ["Storage", "1TB NVMe SSD"],
    ],
    competitors: [
      {
        merchant: "back-market",
        condition: "like-new",
        delta: -35,
        shipping: 45,
        warranty: "1-Year Back Market Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
      {
        merchant: "newegg",
        delta: 90,
        stock: "5 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "amazon-warehouse",
        condition: "open-box-excellent",
        delta: 44,
        stock: "1 in stock",
        returns: "30-day returns",
      },
    ],
  },
  {
    id: "lenovo-x1-carbon-g12",
    brand: "Lenovo",
    model: "ThinkPad X1 Carbon Gen 12 · Ultra 7",
    category: "laptops",
    retailer: "amazon-warehouse",
    condition: "certified-refurbished",
    msrp: 1749,
    price: 1109,
    trend: [1189, 1109],
    dealUrl: "https://www.amazon.com/",
    specs: [
      ["Display", '14" WUXGA IPS Touch · 400 nits'],
      ["Processor", "Intel Core Ultra 7 155U"],
      ["Memory", "32GB LPDDR5x (soldered)"],
      ["Storage", "1TB NVMe SSD"],
      ["Weight", "2.42 lb (1.10 kg)"],
    ],
    competitors: [
      {
        merchant: "back-market",
        condition: "like-new",
        delta: -15,
        shipping: 29,
        warranty: "1-Year Back Market Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
      {
        merchant: "ebay",
        delta: 32,
        shipping: 19,
        stock: "2 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "newegg",
        delta: 65,
        stock: "3 in stock",
        returns: "30-day returns",
      },
    ],
  },

  /* Cameras -------------------------------------------------------- */
  {
    id: "sony-a7-iv-body",
    brand: "Sony",
    model: "Alpha a7 IV Mirrorless · Body Only",
    category: "cameras",
    retailer: "best-buy",
    condition: "open-box-excellent",
    msrp: 2499,
    price: 1899,
    trend: [1999, 1899],
    dealUrl: "https://www.bestbuy.com/",
    inStock: "3 in stock",
    specs: [
      ["Sensor", "33MP full-frame Exmor R CMOS"],
      ["Mount", "Sony E"],
      ["Video", "4K 60p · 10-bit 4:2:2"],
      ["ISO Range", "100–51,200 (expandable)"],
      ["Stabilization", "5-axis in-body · 5.5 stops"],
    ],
    competitors: [
      {
        merchant: "amazon-warehouse",
        condition: "like-new",
        delta: -30,
        shipping: 49,
        warranty: "6-Month Store Warranty",
        stock: "1 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "ebay",
        delta: 45,
        stock: "2 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "adorama",
        condition: "certified-refurbished",
        delta: 76,
        stock: "4 in stock",
        returns: "30-day returns",
      },
    ],
  },
  {
    id: "canon-eos-r6-ii",
    brand: "Canon",
    model: "EOS R6 Mark II · Body Only",
    category: "cameras",
    retailer: "ebay",
    condition: "certified-refurbished",
    msrp: 2499,
    price: 1749,
    trend: [1699, 1749],
    dealUrl: "https://www.ebay.com/",
    inStock: "1 in stock",
    specs: [
      ["Sensor", "24.2MP full-frame CMOS"],
      ["Mount", "Canon RF"],
      ["Video", "4K 60p oversampled · 6K RAW out"],
      ["Burst", "40 fps electronic shutter"],
      ["Stabilization", "5-axis in-body · up to 8 stops"],
    ],
    competitors: [
      {
        merchant: "adorama",
        delta: 60,
        stock: "3 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "best-buy",
        condition: "open-box-excellent",
        delta: 115,
        stock: "1 in stock",
        returns: "15-day returns",
      },
    ],
  },
  {
    id: "gopro-hero12-black",
    brand: "GoPro",
    model: "HERO12 Black Action Camera",
    category: "cameras",
    retailer: "walmart",
    condition: "open-box-excellent",
    msrp: 399,
    price: 249,
    trend: [289, 249],
    dealUrl: "https://www.walmart.com/",
    inStock: "6 in stock",
    specs: [
      ["Video", "5.3K 60p · 4K 120p"],
      ["Photo", "27MP still capture"],
      ["Stabilization", "HyperSmooth 6.0"],
      ["Waterproof", "33 ft (10 m) without housing"],
      ["Battery", "Enduro 1720mAh"],
    ],
    competitors: [
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -7,
        shipping: 15,
        warranty: "6-Month Seller Warranty",
        stock: "2 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "amazon-warehouse",
        delta: 18,
        stock: "4 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "back-market",
        condition: "certified-refurbished",
        delta: 26,
        stock: "In stock",
        returns: "30-day returns",
      },
    ],
  },

  /* Headphones ----------------------------------------------------- */
  {
    id: "sony-wh1000xm5",
    brand: "Sony",
    model: "WH-1000XM5 Noise Cancelling",
    category: "headphones",
    retailer: "best-buy",
    condition: "open-box-excellent",
    msrp: 399,
    price: 268,
    trend: [318, 268],
    dealUrl: "https://www.bestbuy.com/",
    inStock: "8 in stock",
    specs: [
      ["Drivers", "30mm carbon fiber composite"],
      ["Noise Cancelling", "Dual processor · 8 microphones"],
      ["Battery", "30 hours with ANC on"],
      ["Codecs", "LDAC · AAC · SBC"],
      ["Weight", "250 g"],
    ],
    competitors: [
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -9,
        shipping: 12,
        warranty: "6-Month Seller Warranty",
        stock: "3 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "amazon-warehouse",
        delta: 14,
        stock: "6 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "back-market",
        condition: "certified-refurbished",
        delta: 21,
        stock: "In stock",
        returns: "30-day returns",
      },
    ],
  },
  {
    id: "apple-airpods-pro-2",
    brand: "Apple",
    model: "AirPods Pro 2 · USB-C",
    category: "headphones",
    retailer: "amazon-warehouse",
    condition: "certified-refurbished",
    msrp: 249,
    price: 169,
    trend: [189, 169],
    dealUrl: "https://www.amazon.com/",
    inStock: "5 in stock",
    specs: [
      ["Chip", "Apple H2"],
      ["Noise Cancelling", "2× Active Noise Cancellation"],
      ["Battery", "6 hrs · 30 hrs with case"],
      ["Case", "USB-C · MagSafe · speaker"],
      ["Water Resistance", "IP54 (buds and case)"],
    ],
    competitors: [
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -6,
        shipping: 9,
        warranty: "6-Month Seller Warranty",
        stock: "4 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "back-market",
        delta: 12,
        warranty: "1-Year Back Market Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
      {
        merchant: "best-buy",
        condition: "open-box-excellent",
        delta: 20,
        stock: "7 in stock",
        returns: "15-day returns",
      },
    ],
  },
  {
    id: "bose-qc-ultra",
    brand: "Bose",
    model: "QuietComfort Ultra Headphones",
    category: "headphones",
    retailer: "walmart",
    condition: "open-box-excellent",
    msrp: 429,
    price: 289,
    trend: [279, 289],
    dealUrl: "https://www.walmart.com/",
    specs: [
      ["Noise Cancelling", "CustomTune adaptive ANC"],
      ["Spatial Audio", "Bose Immersive Audio"],
      ["Battery", "24 hrs · 18 hrs immersive"],
      ["Codecs", "aptX Adaptive · AAC · SBC"],
      ["Weight", "250 g"],
    ],
    competitors: [
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -10,
        shipping: 14,
        warranty: "6-Month Seller Warranty",
        stock: "2 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "amazon-warehouse",
        delta: 11,
        stock: "3 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "best-buy",
        condition: "certified-refurbished",
        delta: 22,
        stock: "5 in stock",
        returns: "15-day returns",
      },
    ],
  },

  /* Gaming consoles ------------------------------------------------ */
  {
    id: "sony-ps5-slim-disc",
    brand: "Sony",
    model: "PlayStation 5 Slim · Disc Edition",
    category: "consoles",
    retailer: "walmart",
    condition: "open-box-excellent",
    msrp: 499,
    price: 379,
    trend: [429, 379],
    dealUrl: "https://www.walmart.com/",
    inStock: "2 in stock",
    specs: [
      ["Storage", "1TB custom NVMe SSD"],
      ["Optical Drive", "Ultra HD Blu-ray (detachable)"],
      ["Output", "4K 120Hz · 8K ready"],
      ["CPU", "8-core AMD Zen 2 @ 3.5GHz"],
      ["GPU", "10.28 TFLOPs RDNA 2"],
    ],
    competitors: [
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -12,
        shipping: 18,
        warranty: "6-Month Seller Warranty",
        stock: "3 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "best-buy",
        delta: 25,
        stock: "1 in stock",
        returns: "15-day returns",
      },
      {
        merchant: "gamestop",
        condition: "certified-refurbished",
        delta: 30,
        warranty: "1-Year GameStop Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
    ],
  },
  {
    id: "xbox-series-x-1tb",
    brand: "Microsoft",
    model: "Xbox Series X · 1TB",
    category: "consoles",
    retailer: "best-buy",
    condition: "certified-refurbished",
    msrp: 499,
    price: 359,
    trend: [399, 359],
    dealUrl: "https://www.bestbuy.com/",
    inStock: "4 in stock",
    specs: [
      ["Storage", "1TB custom NVMe SSD"],
      ["Optical Drive", "4K UHD Blu-ray"],
      ["Output", "4K 120Hz · 8K ready"],
      ["CPU", "8-core AMD Zen 2 @ 3.8GHz"],
      ["GPU", "12.15 TFLOPs RDNA 2"],
    ],
    competitors: [
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -8,
        shipping: 15,
        warranty: "6-Month Seller Warranty",
        stock: "2 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "walmart",
        condition: "open-box-excellent",
        delta: 14,
        stock: "3 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "gamestop",
        delta: 26,
        warranty: "1-Year GameStop Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
    ],
  },
  {
    id: "nintendo-switch-oled",
    brand: "Nintendo",
    model: "Switch OLED · White Joy-Con",
    category: "consoles",
    retailer: "ebay",
    condition: "open-box-excellent",
    msrp: 349,
    price: 249,
    trend: [279, 249],
    dealUrl: "https://www.ebay.com/",
    inStock: "3 in stock",
    specs: [
      ["Display", '7" OLED multi-touch'],
      ["Storage", "64GB internal · microSD expandable"],
      ["Battery", "4.5–9 hours"],
      ["Dock", "Wired LAN port included"],
      ["Joy-Con", "White · bundled pair"],
    ],
    competitors: [
      {
        merchant: "back-market",
        condition: "like-new",
        delta: -5,
        shipping: 12,
        warranty: "1-Year Back Market Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
      {
        merchant: "walmart",
        delta: 16,
        stock: "5 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "gamestop",
        condition: "certified-refurbished",
        delta: 20,
        warranty: "1-Year GameStop Warranty",
        stock: "In stock",
        returns: "30-day returns",
      },
    ],
  },

  /* TVs ------------------------------------------------------------- */
  {
    id: "lg-c4-oled-65",
    brand: "LG",
    model: 'C4 65" OLED evo 4K Smart TV',
    category: "tvs",
    retailer: "best-buy",
    condition: "open-box-excellent",
    msrp: 2499,
    price: 1499,
    trend: [1799, 1499],
    dealUrl: "https://www.bestbuy.com/",
    inStock: "3 in stock",
    specs: [
      ["Panel", '65" OLED evo · self-lit pixels'],
      ["Resolution", "4K UHD 3840×2160 · 144Hz"],
      ["Processor", "α9 AI Processor Gen7"],
      ["Gaming", "4× HDMI 2.1 · VRR · G-SYNC · FreeSync"],
      ["HDR", "Dolby Vision · HDR10 · HLG"],
    ],
    competitors: [
      {
        merchant: "walmart",
        condition: "like-new",
        delta: -40,
        shipping: 89,
        warranty: "6-Month Store Warranty",
        stock: "1 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "amazon-warehouse",
        delta: 55,
        stock: "2 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "ebay",
        condition: "certified-refurbished",
        delta: 90,
        warranty: "1-Year LG Warranty",
        stock: "4 in stock",
        returns: "14-day returns",
      },
    ],
  },
  {
    id: "samsung-qn90d-55",
    brand: "Samsung",
    model: 'QN90D 55" Neo QLED 4K',
    category: "tvs",
    retailer: "walmart",
    condition: "certified-refurbished",
    msrp: 1599,
    price: 1049,
    trend: [1199, 1049],
    dealUrl: "https://www.walmart.com/",
    inStock: "5 in stock",
    specs: [
      ["Panel", '55" Neo QLED · Quantum Mini LED'],
      ["Resolution", "4K UHD 3840×2160 · 120Hz"],
      ["Processor", "NQ4 AI Gen2"],
      ["Gaming", "4× HDMI 2.1 · Motion Xcelerator 144Hz"],
      ["HDR", "Quantum HDR+ · HDR10+"],
    ],
    competitors: [
      {
        merchant: "best-buy",
        condition: "open-box-excellent",
        delta: 30,
        stock: "2 in stock",
        returns: "15-day returns",
      },
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -25,
        shipping: 65,
        warranty: "6-Month Seller Warranty",
        stock: "1 in stock",
        returns: "14-day returns",
      },
      {
        merchant: "amazon-warehouse",
        delta: 44,
        stock: "3 in stock",
        returns: "30-day returns",
      },
    ],
  },
  {
    id: "sony-bravia-7-65",
    brand: "Sony",
    model: 'BRAVIA 7 65" Mini LED QLED',
    category: "tvs",
    retailer: "amazon-warehouse",
    condition: "open-box-excellent",
    msrp: 2099,
    price: 1399,
    trend: [1549, 1399],
    dealUrl: "https://www.amazon.com/",
    inStock: "2 in stock",
    specs: [
      ["Panel", '65" Mini LED · XR Backlight Master Drive'],
      ["Resolution", "4K UHD 3840×2160 · 120Hz"],
      ["Processor", "XR Processor with Cognitive Intelligence"],
      ["Gaming", "2× HDMI 2.1 · Auto HDR Tone Mapping for PS5"],
      ["Audio", "Acoustic Multi-Audio · Dolby Atmos"],
    ],
    competitors: [
      {
        merchant: "best-buy",
        delta: 70,
        stock: "1 in stock",
        returns: "15-day returns",
      },
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -30,
        shipping: 79,
        warranty: "6-Month Seller Warranty",
        stock: "2 in stock",
        returns: "14-day returns",
      },
    ],
  },
  {
    id: "tcl-qm7-65",
    brand: "TCL",
    model: 'QM7 65" QD-Mini LED 4K',
    category: "tvs",
    retailer: "walmart",
    condition: "open-box-excellent",
    msrp: 999,
    price: 599,
    trend: [699, 599],
    dealUrl: "https://www.walmart.com/",
    inStock: "7 in stock",
    specs: [
      ["Panel", '65" QD-Mini LED · 500+ dimming zones'],
      ["Resolution", "4K UHD 3840×2160 · 144Hz"],
      ["Platform", "Google TV"],
      ["Gaming", "Game Accelerator 240 · VRR"],
      ["HDR", "Dolby Vision IQ · HDR10+"],
    ],
    competitors: [
      {
        merchant: "best-buy",
        condition: "certified-refurbished",
        delta: 35,
        warranty: "1-Year TCL Warranty",
        stock: "4 in stock",
        returns: "15-day returns",
      },
      {
        merchant: "amazon-warehouse",
        delta: 22,
        stock: "6 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -18,
        shipping: 45,
        warranty: "6-Month Seller Warranty",
        stock: "2 in stock",
        returns: "14-day returns",
      },
    ],
  },

  /* Appliances ------------------------------------------------------ */
  {
    id: "lg-wm4000-washer",
    brand: "LG",
    model: "WM4000HWA Front Load Washer · 4.5 cu ft",
    category: "appliances",
    retailer: "best-buy",
    condition: "open-box-excellent",
    msrp: 1099,
    price: 719,
    trend: [849, 719],
    dealUrl: "https://www.bestbuy.com/",
    inStock: "4 in stock",
    specs: [
      ["Capacity", "4.5 cu ft front-load drum"],
      ["Cycles", "12 wash cycles · Allergiene steam"],
      ["Motor", "Direct Drive inverter · 10-year warranty"],
      ["Speed", "TurboWash 360 — full load in 30 min"],
      ["Dimensions", '27" W × 39" H × 30.25" D'],
    ],
    competitors: [
      {
        merchant: "walmart",
        condition: "like-new",
        delta: -30,
        shipping: 99,
        warranty: "6-Month Store Warranty",
        stock: "2 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "ebay",
        condition: "certified-refurbished",
        delta: 45,
        warranty: "1-Year LG Warranty",
        stock: "1 in stock",
        returns: "14-day returns",
      },
    ],
  },
  {
    id: "samsung-dve45-dryer",
    brand: "Samsung",
    model: "DVE45 Electric Dryer · 7.5 cu ft",
    category: "appliances",
    retailer: "walmart",
    condition: "open-box-excellent",
    msrp: 949,
    price: 599,
    trend: [689, 599],
    dealUrl: "https://www.walmart.com/",
    inStock: "3 in stock",
    specs: [
      ["Capacity", "7.5 cu ft electric dryer"],
      ["Cycles", "10 dry cycles · Steam Sanitize+"],
      ["Sensor", "Sensor Dry moisture detection"],
      ["Vent", "Vent Sensor with alert"],
      ["Dimensions", '27" W × 38.75" H × 31.5" D'],
    ],
    competitors: [
      {
        merchant: "best-buy",
        delta: 40,
        stock: "5 in stock",
        returns: "15-day returns",
      },
      {
        merchant: "amazon-warehouse",
        condition: "certified-refurbished",
        delta: 58,
        stock: "2 in stock",
        returns: "30-day returns",
      },
      {
        merchant: "ebay",
        condition: "like-new",
        delta: -22,
        shipping: 89,
        warranty: "6-Month Seller Warranty",
        stock: "1 in stock",
        returns: "14-day returns",
      },
    ],
  },
  {
    id: "bosch-300-dishwasher",
    brand: "Bosch",
    model: "300 Series Dishwasher · 44 dBA",
    category: "appliances",
    retailer: "ebay",
    condition: "certified-refurbished",
    msrp: 949,
    price: 629,
    trend: [699, 629],
    dealUrl: "https://www.ebay.com/",
    inStock: "2 in stock",
    specs: [
      ["Noise", "44 dBA — among the quietest in class"],
      ["Racks", "3rd rack with RackMatic adjustment"],
      ["Cycles", "5 wash cycles · 5 options"],
      ["Drying", "PrecisionWash with AutoAir"],
      ["Dimensions", '23.56" W × 33.875" H × 23.75" D'],
    ],
    competitors: [
      {
        merchant: "best-buy",
        condition: "open-box-excellent",
        delta: 35,
        stock: "3 in stock",
        returns: "15-day returns",
      },
      {
        merchant: "walmart",
        condition: "like-new",
        delta: -15,
        shipping: 79,
        warranty: "6-Month Store Warranty",
        stock: "1 in stock",
        returns: "30-day returns",
      },
    ],
  },
] satisfies Seed[];

/**
 * Search metadata, kept out of the seeds above so those stay focused on
 * pricing. `description` is prose the full-text matcher scores against but the
 * card never renders; `keywords` carries the terms a shopper actually types
 * that appear nowhere in the title — "washing machine" for a unit branded
 * "Front Load Washer", "television" for a TV, "xbox" for a Microsoft console.
 *
 * Keyed by the literal seed ids, so adding a product without search copy is a
 * type error rather than a listing that quietly never matches a query.
 */
const SEARCH_COPY: Record<
  (typeof SEEDS)[number]["id"],
  { description: string; keywords: string[] }
> = {
  "apple-mba-m2-16-512": {
    description:
      "Ultraportable 13-inch Apple laptop with the M2 chip, 16GB unified memory and a 512GB SSD. Fanless, 18-hour battery, Liquid Retina display.",
    keywords: ["macbook", "mac", "notebook", "ultrabook", "m2", "apple silicon"],
  },
  "dell-xps-15-9530": {
    description:
      "15-inch Windows creator laptop with a Core i7, RTX 4060 graphics, 32GB DDR5 and a 1TB NVMe SSD. Built for video editing and 3D work.",
    keywords: ["notebook", "windows laptop", "gaming laptop", "workstation", "rtx"],
  },
  "lenovo-x1-carbon-g12": {
    description:
      "Business ultrabook weighing 2.42 lb with an Intel Core Ultra 7, 32GB LPDDR5x and a 14-inch touch display. MIL-STD tested chassis.",
    keywords: ["thinkpad", "notebook", "business laptop", "ultrabook", "lenovo"],
  },
  "sony-a7-iv-body": {
    description:
      "33MP full-frame mirrorless camera body with 4K 60p 10-bit video and 5-axis in-body stabilization. Sony E mount, no lens included.",
    keywords: ["mirrorless", "full frame", "alpha", "a7iv", "camera body", "photography"],
  },
  "canon-eos-r6-ii": {
    description:
      "24.2MP full-frame mirrorless camera with 40 fps burst shooting, 6K RAW output and up to 8 stops of stabilization. Canon RF mount.",
    keywords: ["mirrorless", "full frame", "eos", "r6", "camera body", "photography"],
  },
  "gopro-hero12-black": {
    description:
      "Waterproof action camera shooting 5.3K 60p with HyperSmooth 6.0 stabilization. Rugged to 33 feet without a housing.",
    keywords: ["action camera", "hero", "vlogging", "waterproof camera", "helmet cam"],
  },
  "sony-wh1000xm5": {
    description:
      "Over-ear wireless noise cancelling headphones with dual processors, eight microphones, LDAC support and 30-hour battery life.",
    keywords: ["headphones", "anc", "noise cancelling", "over ear", "wireless", "xm5"],
  },
  "apple-airpods-pro-2": {
    description:
      "In-ear wireless earbuds with the Apple H2 chip, adaptive active noise cancellation and a USB-C MagSafe charging case. IP54 rated.",
    keywords: ["earbuds", "airpods", "anc", "noise cancelling", "in ear", "wireless"],
  },
  "bose-qc-ultra": {
    description:
      "Over-ear wireless headphones with CustomTune adaptive noise cancelling and Bose Immersive spatial audio. 24-hour battery.",
    keywords: ["headphones", "anc", "noise cancelling", "over ear", "quietcomfort", "wireless"],
  },
  "sony-ps5-slim-disc": {
    description:
      "Current-generation Sony games console with a 1TB SSD, detachable 4K Blu-ray drive and 4K 120Hz output. DualSense controller included.",
    keywords: ["playstation", "ps5", "console", "gaming console", "video game system"],
  },
  "xbox-series-x-1tb": {
    description:
      "Microsoft's flagship games console — 12 teraflops of RDNA 2 graphics, a 1TB SSD, 4K UHD Blu-ray drive and 4K 120Hz output.",
    keywords: ["xbox", "series x", "console", "gaming console", "microsoft", "video game system"],
  },
  "nintendo-switch-oled": {
    description:
      "Hybrid handheld and docked console with a 7-inch OLED touchscreen, 64GB storage and a wired LAN dock. White Joy-Con pair included.",
    keywords: ["switch", "nintendo", "console", "handheld", "gaming console", "oled"],
  },
  "lg-c4-oled-65": {
    description:
      "65-inch OLED evo smart TV with perfect blacks, a 144Hz panel and four HDMI 2.1 ports. Dolby Vision, G-SYNC and FreeSync certified.",
    keywords: ["tv", "television", "oled", "4k tv", "smart tv", "65 inch", "flat screen"],
  },
  "samsung-qn90d-55": {
    description:
      "55-inch Neo QLED 4K television using Quantum Mini LED backlighting for high brightness in lit rooms. 144Hz gaming, HDR10+.",
    keywords: ["tv", "television", "qled", "4k tv", "smart tv", "55 inch", "neo qled", "flat screen"],
  },
  "sony-bravia-7-65": {
    description:
      "65-inch Mini LED television with XR Backlight Master Drive processing and PlayStation 5 auto HDR tone mapping. Dolby Atmos audio.",
    keywords: ["tv", "television", "mini led", "4k tv", "smart tv", "65 inch", "bravia", "flat screen"],
  },
  "tcl-qm7-65": {
    description:
      "Value 65-inch QD-Mini LED 4K television with over 500 dimming zones, a 144Hz panel and Google TV built in. Dolby Vision IQ.",
    keywords: ["tv", "television", "qled", "4k tv", "smart tv", "65 inch", "google tv", "flat screen"],
  },
  "lg-wm4000-washer": {
    description:
      "4.5 cu ft front-load washing machine with TurboWash 360 for 30-minute full loads, Allergiene steam cycle and a direct-drive inverter motor.",
    keywords: [
      "washing machine",
      "washer",
      "laundry",
      "front load",
      "clothes washer",
      "appliance",
      "white goods",
    ],
  },
  "samsung-dve45-dryer": {
    description:
      "7.5 cu ft electric clothes dryer with Sensor Dry moisture detection, Steam Sanitize+ and a vent-blockage alert.",
    keywords: [
      "dryer",
      "tumble dryer",
      "clothes dryer",
      "laundry",
      "electric dryer",
      "appliance",
      "white goods",
    ],
  },
  "bosch-300-dishwasher": {
    description:
      "Built-in 44 dBA dishwasher with a third rack, RackMatic height adjustment and PrecisionWash sensors with AutoAir drying.",
    keywords: [
      "dishwasher",
      "kitchen appliance",
      "appliance",
      "built in dishwasher",
      "white goods",
    ],
  },
};

/**
 * Expands a seed into the full offer set: the headline listing plus every
 * competitor, each priced and ranked by total cost to the buyer.
 *
 * A competitor that names the headline merchant is dropped — two rows for one
 * store would collide on `id` and read as a duplicate listing.
 */
function buildOffers(seed: Seed): MerchantOffer[] {
  const headline: MerchantOffer = {
    id: `${seed.id}--${seed.retailer}`,
    merchant: seed.retailer,
    condition: seed.condition,
    warranty: defaultWarranty(seed.brand, seed.condition),
    price: seed.price,
    shipping: 0,
    cashback: cashback(seed.price),
    dealUrl: seed.dealUrl,
    stock: seed.inStock ?? "In stock",
    returns: "30-day returns",
  };

  const rivals = seed.competitors
    .filter((c) => c.merchant !== seed.retailer)
    .map((c) => {
      const condition = c.condition ?? seed.condition;
      const price = seed.price + c.delta;

      return {
        id: `${seed.id}--${c.merchant}`,
        merchant: c.merchant,
        condition,
        warranty: c.warranty ?? defaultWarranty(seed.brand, condition),
        price,
        shipping: c.shipping ?? 0,
        cashback: cashback(price),
        dealUrl: RETAILERS[c.merchant].home,
        stock: c.stock ?? "In stock",
        returns: c.returns ?? "30-day returns",
      } satisfies MerchantOffer;
    });

  return sortOffersByValue([headline, ...rivals]);
}

export const MOCK_PRODUCTS: Product[] = SEEDS.map((seed, i) => {
  const offers = buildOffers(seed);
  const best = offers[0];
  // `seed` is narrowed to its literal shape by `satisfies`, which drops the
  // optional Seed fields no fixture happens to set. Widen to read them.
  const { image, gallery } = seed as Seed;

  return {
    id: seed.id,
    brand: seed.brand,
    model: seed.model,
    category: seed.category,
    description: SEARCH_COPY[seed.id].description,
    keywords: SEARCH_COPY[seed.id].keywords,
    image,
    gallery,
    msrp: seed.msrp,
    // The card summarises the winning offer, so the two can never disagree —
    // even if a competitor is ever priced below the headline listing.
    retailer: best.merchant,
    condition: best.condition,
    price: best.price,
    dealUrl: best.dealUrl,
    inStock: best.stock,
    cashback: best.cashback,
    priceHistory: priceSeries(seed.trend[0], best.price, i + 1),
    specs: seed.specs.map(([label, value]) => ({ label, value })),
    offers,
  };
});

/** Catalog lookup for the product route. `undefined` for an unknown id. */
export const productById = (id: string): Product | undefined =>
  MOCK_PRODUCTS.find((p) => p.id === id);
