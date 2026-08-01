import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/vision
 *
 * Takes a base64 product screenshot and returns structured open-box
 * specifications extracted by Claude's vision model.
 *
 * Body: { image: string (base64, data-URL prefix optional),
 *         mediaType?: "image/png" | "image/jpeg" | "image/webp" | "image/gif",
 *         hint?: string }
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

const SYSTEM_PROMPT = `You identify consumer electronics from product screenshots for an open-box and refurbished resale marketplace.

Extract only what is legible in the image. Precision matters more than completeness: a wrong model number sends a buyer to the wrong listing. When a specification is not visible, set it to null rather than inferring it from the product family. Do not guess storage, RAM, colour, or model year from a picture of the device alone — read them from on-screen text.

Set confidence to "high" only when the brand and exact model are both explicitly written in the image.`;

/** Structured-output schema — the API validates the response against this. */
const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    identified: {
      type: "boolean",
      description: "False if the image contains no identifiable product.",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    brand: { type: ["string", "null"] },
    model: {
      type: ["string", "null"],
      description: "Exact model name as printed, e.g. 'MacBook Air 13-inch M2'.",
    },
    modelNumber: {
      type: ["string", "null"],
      description: "SKU / MPN / part number if visible, e.g. 'MLY33LL/A'.",
    },
    category: {
      type: "string",
      enum: ["laptops", "cameras", "headphones", "consoles", "other"],
    },
    specifications: {
      type: "object",
      description: "Only specs legible in the image; null when not shown.",
      properties: {
        storage: { type: ["string", "null"] },
        memory: { type: ["string", "null"] },
        processor: { type: ["string", "null"] },
        screenSize: { type: ["string", "null"] },
        color: { type: ["string", "null"] },
        modelYear: { type: ["string", "null"] },
      },
      required: [
        "storage",
        "memory",
        "processor",
        "screenSize",
        "color",
        "modelYear",
      ],
      additionalProperties: false,
    },
    conditionStated: {
      type: ["string", "null"],
      description:
        "Condition wording shown in the image, e.g. 'Open-Box Excellent'. Null if absent.",
    },
    listedPrice: {
      type: ["number", "null"],
      description: "Numeric price visible in the image, USD, no currency symbol.",
    },
    retailer: {
      type: ["string", "null"],
      description: "Retailer identifiable from branding or URL bar.",
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
    "brand",
    "model",
    "modelNumber",
    "category",
    "specifications",
    "conditionStated",
    "listedPrice",
    "retailer",
    "searchKeywords",
    "notes",
  ],
  additionalProperties: false,
} as const;

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

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error: "not_configured",
        message: "ANTHROPIC_API_KEY is not set on the server.",
      },
      { status: 503 },
    );
  }

  let body: { image?: unknown; mediaType?: unknown; hint?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Body must be JSON." },
      { status: 400 },
    );
  }

  if (typeof body.image !== "string" || body.image.length === 0) {
    return NextResponse.json(
      { error: "invalid_request", message: "`image` (base64) is required." },
      { status: 400 },
    );
  }

  const { data, mediaType: inlineType } = parseImagePayload(body.image);

  const mediaType = (inlineType ??
    (typeof body.mediaType === "string" ? body.mediaType : "image/png")) as
    | MediaType
    | string;

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

  const hint =
    typeof body.hint === "string" && body.hint.trim()
      ? `\n\nContext from the user: ${body.hint.trim()}`
      : "";

  const client = new Anthropic();

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
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as MediaType,
                data,
              },
            },
            {
              type: "text",
              text: `Identify this product and extract its open-box specifications.${hint}`,
            },
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
          message: "The model declined to process this image.",
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

    let extraction: unknown;
    try {
      extraction = JSON.parse(text);
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

    return NextResponse.json({
      model: response.model,
      stopReason: response.stop_reason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      extraction,
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
