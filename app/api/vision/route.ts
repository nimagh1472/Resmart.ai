import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CONDITIONS_API, type CardCondition } from "@/lib/catalog";
import { MOCK_PRODUCTS } from "@/lib/mock-products";
import { searchAny } from "@/lib/search";
import {
  buildAiMatchOffers,
  inferProduct,
  type InferredCategory,
  type ParsedProduct,
} from "@/lib/product-inference";

/**
 * POST /api/vision
 *
 * Identifies a product from a screenshot, a retail URL, or a plain-text
 * description, and returns it alongside matching inventory.
 *
 * Body: { image?: string (base64, data-URL prefix optional),
 *         mediaType?: "image/png" | "image/jpeg" | "image/webp" | "image/gif",
 *         url?: string (retail product page),
 *         filename?: string (upload name — often names the product),
 *         hint?: string (free text from the user) }
 *
 * At least one of `image`, `url`, or `hint` is required.
 *
 * Two paths produce the same response shape:
 *
 *  - With `ANTHROPIC_API_KEY` set, Claude reads the image and/or the link and
 *    extracts what is actually there.
 *  - Without it, `lib/product-inference` parses the URL slug, filename, and
 *    text deterministically. Degraded, clearly labelled via `source`, but the
 *    feature stays usable — a missing key shouldn't turn the whole flow into a
 *    503, and it must never fall back to a canned result.
 */

// Claude 3.5 Sonnet was retired 2025-10-28 and now 404s; Sonnet 5 is its
// documented replacement and is the current Sonnet-tier vision model.
const MODEL = "claude-sonnet-5";

// Anthropic's image limit is 5MB per image; base64 inflates bytes by ~4/3.
const MAX_BASE64_CHARS = 7_000_000;

const SUPPORTED_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
type MediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

const CATEGORIES: InferredCategory[] = [
  "laptops",
  "cameras",
  "headphones",
  "consoles",
  "tvs",
  "appliances",
  "other",
];

const CONDITIONS = Object.keys(CONDITIONS_API) as CardCondition[];

const SYSTEM_PROMPT = `You identify consumer products for an open-box and refurbished resale marketplace. Input is a product screenshot, a retail product URL, a shopper's description, or some combination.

Read what is actually in front of you. A washing machine listing must come back as a washing machine, a television as a television — never substitute a product family you have seen more often.

Precision rules:
- Extract specifications only when they are legible in the image or stated in the text. A specification you cannot see is null, not a guess from the product family. Do not infer storage, RAM, colour, or model year from a picture of the device alone.
- \`listedPrice\` is only for a price literally shown. Null otherwise.
- \`estimatedMsrp\` is the exception: always provide your best estimate of the product's original US launch MSRP in USD, even when no price is visible. Set \`msrpSource\` to "listed" only when that number came from the input itself, otherwise "estimated".
- \`condition\` is the resale grade. Use the stated grade when the listing gives one; otherwise pick the grade this item would most likely be listed under and record the wording you saw in \`conditionStated\` (null if none).
- Set \`identified: false\` when the input contains no recognizable product.
- Set \`confidence\` to "high" only when the brand and exact model are both explicit in the input.`;

/** Structured-output schema — the API validates the response against this. */
const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    identified: {
      type: "boolean",
      description: "False if the input contains no identifiable product.",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    productName: {
      type: "string",
      description:
        "Full display name as a shopper would recognize it, e.g. 'LG C4 65\" OLED evo 4K Smart TV'.",
    },
    brand: { type: ["string", "null"] },
    model: {
      type: ["string", "null"],
      description: "Model line as printed, e.g. 'C4', 'WM4000HWA', 'Series X'.",
    },
    modelNumber: {
      type: ["string", "null"],
      description: "SKU / MPN / part number if visible, e.g. 'MLY33LL/A'.",
    },
    category: { type: "string", enum: CATEGORIES },
    condition: {
      type: "string",
      enum: CONDITIONS,
      description: "Resale grade this item would be listed under.",
    },
    conditionStated: {
      type: ["string", "null"],
      description:
        "Condition wording present in the input, e.g. 'Open-Box Excellent'. Null if absent.",
    },
    estimatedMsrp: {
      type: "number",
      description: "Original US launch MSRP in USD. Always provide an estimate.",
    },
    msrpSource: { type: "string", enum: ["listed", "estimated"] },
    listedPrice: {
      type: ["number", "null"],
      description: "Price literally visible in the input, USD, no currency symbol.",
    },
    retailer: {
      type: ["string", "null"],
      description: "Retailer identifiable from branding, the URL, or the URL bar.",
    },
    specifications: {
      type: "object",
      description: "Only specs legible in the input; null when not shown.",
      properties: {
        storage: { type: ["string", "null"] },
        memory: { type: ["string", "null"] },
        processor: { type: ["string", "null"] },
        screenSize: { type: ["string", "null"] },
        capacity: {
          type: ["string", "null"],
          description: "Appliance capacity, e.g. '4.5 cu ft'.",
        },
        color: { type: ["string", "null"] },
        modelYear: { type: ["string", "null"] },
      },
      required: [
        "storage",
        "memory",
        "processor",
        "screenSize",
        "capacity",
        "color",
        "modelYear",
      ],
      additionalProperties: false,
    },
    searchKeywords: {
      type: "array",
      items: { type: "string" },
      description: "3–8 terms for matching this product against inventory.",
    },
    notes: {
      type: ["string", "null"],
      description: "Anything ambiguous a human should double-check.",
    },
  },
  required: [
    "identified",
    "confidence",
    "productName",
    "brand",
    "model",
    "modelNumber",
    "category",
    "condition",
    "conditionStated",
    "estimatedMsrp",
    "msrpSource",
    "listedPrice",
    "retailer",
    "specifications",
    "searchKeywords",
    "notes",
  ],
  additionalProperties: false,
} as const;

/** The unified shape both the model path and the heuristic path return. */
type Extraction = {
  identified: boolean;
  confidence: "high" | "medium" | "low";
  productName: string;
  brand: string | null;
  model: string | null;
  modelNumber: string | null;
  category: InferredCategory;
  categoryLabel: string;
  condition: CardCondition;
  conditionLabel: string;
  conditionStated: string | null;
  estimatedMsrp: number;
  msrpSource: "listed" | "estimated";
  listedPrice: number | null;
  retailer: string | null;
  specifications: Record<string, string | null>;
  searchKeywords: string[];
  notes: string | null;
};

const CATEGORY_LABELS: Record<InferredCategory, string> = {
  laptops: "Laptops",
  cameras: "Cameras",
  headphones: "Headphones",
  consoles: "Gaming Consoles",
  tvs: "TVs",
  appliances: "Appliances",
  other: "Electronics",
};

/** Strips a `data:image/png;base64,` prefix and reports the declared type. */
function parseImagePayload(raw: string): {
  data: string;
  mediaType: MediaType | null;
} {
  // [\s\S] rather than the `s` flag — tsconfig targets ES5.
  const match = /^data:(image\/[a-zA-Z+]+);base64,([\s\S]*)$/.exec(raw);
  if (match) {
    return {
      data: match[2],
      mediaType: SUPPORTED_MEDIA_TYPES.includes(match[1] as MediaType)
        ? (match[1] as MediaType)
        : null,
    };
  }
  return { data: raw, mediaType: null };
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Heuristic parse → the unified extraction shape. */
function fromInference(parsed: ParsedProduct): Extraction {
  return {
    identified: parsed.identified,
    confidence: parsed.confidence,
    productName: parsed.productName,
    brand: parsed.brand,
    model: null,
    modelNumber: null,
    category: parsed.category,
    categoryLabel: parsed.categoryLabel,
    condition: parsed.condition,
    conditionLabel: CONDITIONS_API[parsed.condition].label,
    conditionStated: null,
    estimatedMsrp: parsed.estimatedMsrp,
    msrpSource: parsed.msrpSource,
    listedPrice: parsed.listedPrice,
    retailer: parsed.retailer,
    specifications: {},
    searchKeywords: parsed.searchKeywords,
    notes: parsed.notes,
  };
}

/**
 * Claude's JSON → the unified shape, with the heuristic parse standing in for
 * anything the model left blank. The model owns what it can see; the fallback
 * owns the derived numbers.
 */
function fromModel(raw: Record<string, unknown>, fallback: ParsedProduct): Extraction {
  const category = (
    CATEGORIES.includes(raw.category as InferredCategory)
      ? raw.category
      : fallback.category
  ) as InferredCategory;

  const condition = (
    CONDITIONS.includes(raw.condition as CardCondition)
      ? raw.condition
      : fallback.condition
  ) as CardCondition;

  const msrp =
    typeof raw.estimatedMsrp === "number" && raw.estimatedMsrp > 0
      ? Math.round(raw.estimatedMsrp)
      : fallback.estimatedMsrp;

  const keywords = Array.isArray(raw.searchKeywords)
    ? raw.searchKeywords.filter((k): k is string => typeof k === "string")
    : [];

  const specs =
    raw.specifications && typeof raw.specifications === "object"
      ? Object.fromEntries(
          Object.entries(raw.specifications as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};

  return {
    identified: raw.identified !== false,
    confidence:
      raw.confidence === "high" || raw.confidence === "medium" ? raw.confidence : "low",
    productName: str(raw.productName) ?? fallback.productName,
    brand: str(raw.brand) ?? fallback.brand,
    model: str(raw.model),
    modelNumber: str(raw.modelNumber),
    category,
    categoryLabel: CATEGORY_LABELS[category],
    condition,
    conditionLabel: CONDITIONS_API[condition].label,
    conditionStated: str(raw.conditionStated),
    estimatedMsrp: msrp,
    msrpSource: raw.msrpSource === "listed" ? "listed" : "estimated",
    listedPrice: typeof raw.listedPrice === "number" ? raw.listedPrice : null,
    retailer: str(raw.retailer) ?? fallback.retailer,
    specifications: specs,
    searchKeywords: keywords.length > 0 ? keywords : fallback.searchKeywords,
    notes: str(raw.notes),
  };
}

/**
 * Spec/marketing tokens that appear on half the catalog and therefore say
 * nothing about *which* unit this is.
 */
const GENERIC_TOKENS = new Set([
  "4k",
  "8k",
  "uhd",
  "hd",
  "hdr",
  "1080p",
  "60hz",
  "120hz",
  "144hz",
  "wifi",
  "usb",
]);

const tokensOf = (value: string) =>
  new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((t) => t.length > 1 && !GENERIC_TOKENS.has(t)),
  );

/**
 * Is this listing *the scanned product*, or merely the nearest thing we stock?
 *
 * The distinction matters: a MacBook Pro scan will always surface the MacBook
 * Air as the closest laptop in inventory, and presenting that as "in stock"
 * is the exact bait-and-switch this flow is supposed to avoid. So a listing is
 * only confirmed when the brand and category agree *and* it shares a genuine
 * identifier with the scan — a model number or size ("C4", "1TB", "65"), or
 * failing that at least two distinctive words of the model line.
 */
function isConfirmedMatch(
  extraction: Extraction,
  product: (typeof MOCK_PRODUCTS)[number],
): boolean {
  if (!extraction.brand) return false;
  if (extraction.brand.toLowerCase() !== product.brand.toLowerCase()) return false;
  if (extraction.category !== product.category) return false;

  const scanned = tokensOf(
    [extraction.productName, extraction.model, ...extraction.searchKeywords]
      .filter(Boolean)
      .join(" "),
  );
  const listing = tokensOf(product.model);

  // Identifier tokens carry a digit: "c4", "65", "1tb", "dve45", "m2".
  const scannedIds = Array.from(scanned).filter((t) => /\d/.test(t));
  const listingIds = Array.from(listing).filter((t) => /\d/.test(t));
  if (scannedIds.length > 0 && listingIds.length > 0) {
    return scannedIds.some((t) => listing.has(t));
  }

  // No model numbers anywhere ("Samsung Electric Dryer") — fall back to how
  // much of the model line the scan actually named.
  const shared = Array.from(listing).filter((t) => scanned.has(t));
  return shared.length >= 2;
}

/**
 * Real inventory for the identified product, plus projected open-box offers
 * when we don't stock it. This is what makes the scan actionable rather than
 * an isolated classification result.
 */
function buildMatches(extraction: Extraction) {
  const ranked = searchAny(
    [
      extraction.productName,
      [extraction.brand, extraction.model].filter(Boolean).join(" "),
      ...extraction.searchKeywords,
    ],
    MOCK_PRODUCTS,
  );

  const shape = ({ product, matchedFields }: (typeof ranked)[number]) => ({
    id: product.id,
    title: `${product.brand} ${product.model}`,
    category: product.category,
    condition: product.condition,
    conditionLabel: CONDITIONS_API[product.condition].label,
    msrp: product.msrp,
    price: product.price,
    savings: product.msrp - product.price,
    retailer: product.retailer,
    offerCount: product.offers.length,
    // Best-value offer's outbound link — `offers` is always non-empty and
    // pre-sorted by `sortOffersByValue`, so index 0 is the one to buy.
    dealUrl: product.offers[0].dealUrl,
    matchedFields,
  });

  const confirmed = ranked.filter((hit) => isConfirmedMatch(extraction, hit.product));
  const related = ranked.filter((hit) => !confirmed.includes(hit));

  return {
    catalogMatches: confirmed.map(shape),
    /** Same class of product, but not the one that was scanned. */
    relatedMatches: related.map(shape),
    // Only projected when we don't actually stock the scanned item — showing
    // both would read as live inventory we can't deliver.
    projectedOffers:
      confirmed.length === 0
        ? buildAiMatchOffers({
            identified: extraction.identified,
            confidence: extraction.confidence,
            productName: extraction.productName,
            brand: extraction.brand,
            category: extraction.category,
            categoryLabel: extraction.categoryLabel,
            condition: extraction.condition,
            estimatedMsrp: extraction.estimatedMsrp,
            msrpSource: extraction.msrpSource,
            listedPrice: extraction.listedPrice,
            retailer: extraction.retailer,
            searchKeywords: extraction.searchKeywords,
            notes: extraction.notes,
          })
        : [],
  };
}

export async function POST(request: Request) {
  let body: {
    image?: unknown;
    mediaType?: unknown;
    url?: unknown;
    hint?: unknown;
    filename?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Body must be JSON." },
      { status: 400 },
    );
  }

  const image = typeof body.image === "string" && body.image ? body.image : null;
  const url = str(body.url);
  const hint = str(body.hint);
  const filename = str(body.filename);

  if (!image && !url && !hint) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "Provide at least one of `image`, `url`, or `hint`.",
      },
      { status: 400 },
    );
  }

  if (url && !/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { error: "invalid_request", message: "`url` must be an http(s) URL." },
      { status: 400 },
    );
  }

  let data: string | null = null;
  let mediaType: string = "image/png";

  if (image) {
    const payload = parseImagePayload(image);
    data = payload.data;
    mediaType =
      payload.mediaType ??
      (typeof body.mediaType === "string" ? body.mediaType : "image/png");

    if (!SUPPORTED_MEDIA_TYPES.includes(mediaType as MediaType)) {
      return NextResponse.json(
        {
          error: "unsupported_media_type",
          message: `mediaType must be one of ${SUPPORTED_MEDIA_TYPES.join(", ")}.`,
        },
        { status: 415 },
      );
    }

    if (data.length > MAX_BASE64_CHARS) {
      return NextResponse.json(
        {
          error: "payload_too_large",
          message: "Image exceeds the 5MB limit. Downscale before uploading.",
        },
        { status: 413 },
      );
    }
  }

  // Always computed: it is the whole answer when there's no API key, and it
  // backfills the numbers Claude is told not to invent when there is one.
  const inferred = inferProduct({ url, text: hint, filename });

  if (!process.env.ANTHROPIC_API_KEY) {
    const extraction = fromInference(inferred);
    return NextResponse.json({
      source: "heuristic",
      degraded: true,
      message:
        "ANTHROPIC_API_KEY is not set — parsed from the link, filename, and text only.",
      model: null,
      usage: null,
      extraction,
      ...buildMatches(extraction),
    });
  }

  const client = new Anthropic();

  const instructions = [
    "Identify this product and extract its open-box specifications.",
    url ? `Retail product URL: ${url}` : null,
    filename ? `Uploaded filename: ${filename}` : null,
    hint ? `Context from the user: ${hint}` : null,
    data
      ? null
      : "No image was provided — work from the URL and text above, including any product name encoded in the URL path.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            ...(data
              ? ([
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mediaType as MediaType,
                      data,
                    },
                  },
                ] as const)
              : []),
            { type: "text", text: instructions },
          ],
        },
      ],
    });

    // A safety decline returns HTTP 200 with an empty/partial content array,
    // so stop_reason must be checked before reading content.
    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        {
          error: "refused",
          message: "The model declined to process this input.",
          category: response.stop_details?.category ?? null,
        },
        { status: 422 },
      );
    }

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) {
      return NextResponse.json(
        {
          error: "empty_response",
          message: "The model returned no text block.",
          stopReason: response.stop_reason,
        },
        { status: 502 },
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      // Structured outputs make this near-impossible, but a max_tokens cutoff
      // can still truncate the JSON mid-object.
      return NextResponse.json(
        {
          error: "malformed_output",
          message: "The model's response was not valid JSON.",
          stopReason: response.stop_reason,
        },
        { status: 502 },
      );
    }

    const extraction = fromModel(raw as Record<string, unknown>, inferred);

    return NextResponse.json({
      source: data ? "claude-vision" : "claude-text",
      degraded: false,
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      extraction,
      ...buildMatches(extraction),
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many requests. Retry shortly." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "auth_failed", message: "Invalid ANTHROPIC_API_KEY." },
        { status: 500 },
      );
    }
    if (error instanceof Anthropic.BadRequestError) {
      return NextResponse.json(
        { error: "bad_request", message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return NextResponse.json(
        { error: "upstream_unreachable", message: "Could not reach the Claude API." },
        { status: 504 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: "upstream_error", message: error.message },
        { status: 502 },
      );
    }
    throw error;
  }
}
