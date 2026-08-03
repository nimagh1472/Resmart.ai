import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CONDITIONS_API, type CardCondition } from "@/lib/catalog";

/**
 * POST /api/merchants/ai
 *
 * Merchant listing assistant. Two tasks, one route:
 *   { task: "price",       title, condition, msrp, stock? }
 *   { task: "description", title, condition, msrp, price }
 *
 * Both return structured JSON validated by the API against a schema, so the
 * dashboard can drop the result straight into form state. When
 * ANTHROPIC_API_KEY is unset the route answers from a deterministic heuristic
 * and flags `source: "heuristic"` — the merchant tools stay usable without a
 * key, and the UI can label the difference.
 */

const MODEL = "claude-opus-5";

const SYSTEM_PROMPT = `You assist merchants listing open-box and certified refurbished consumer electronics on ReSmart, a price-comparison marketplace.

Price for the secondary market, not retail: buyers arrive comparing several listings of the same model, so a price above the going open-box rate does not sell. Condition is the dominant factor after MSRP — certified refurbished carries a deeper discount than open-box excellent because the unit has been used and restored.

Write descriptions for a shopper deciding between listings, not for a search engine. State what the item is, what condition it is in, and what is included. Never invent specifications, warranty terms, accessories, or defects that were not given to you: if the merchant did not state it, leave it out.`;

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const TIERS = ["quick-sale", "market", "premium"] as const;
type Tier = (typeof TIERS)[number];

const PRICE_SCHEMA = {
  type: "object",
  properties: {
    tiers: {
      type: "array",
      description: "Exactly three tiers, one per tier name, cheapest first.",
      items: {
        type: "object",
        properties: {
          tier: { type: "string", enum: [...TIERS] },
          price: { type: "number", description: "USD, at or below MSRP." },
          discountPercent: {
            type: "integer",
            description: "Whole-percent discount off MSRP.",
          },
          note: {
            type: "string",
            description: "One short line on the trade-off at this tier.",
          },
        },
        required: ["tier", "price", "discountPercent", "note"],
        additionalProperties: false,
      },
    },
    recommendedTier: { type: "string", enum: [...TIERS] },
    rationale: {
      type: "string",
      description: "Two sentences at most, addressed to the merchant.",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["tiers", "recommendedTier", "rationale", "confidence"],
  additionalProperties: false,
} as const;

const DESCRIPTION_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "Under 80 characters. No ALL CAPS, no exclamation marks.",
    },
    description: {
      type: "string",
      description:
        "Two short paragraphs of plain prose, 60–110 words in total.",
    },
    bullets: {
      type: "array",
      description: "3–5 scannable highlights, each under 60 characters.",
      items: { type: "string" },
    },
  },
  required: ["headline", "description", "bullets"],
  additionalProperties: false,
} as const;

/* ------------------------------------------------------------------ */
/* Heuristic fallback                                                  */
/* ------------------------------------------------------------------ */

/** Baseline open-box discount off MSRP, by grade. */
const BASE_DISCOUNT: Record<CardCondition, number> = {
  "open-box-excellent": 0.22,
  "certified-refurbished": 0.32,
  "like-new": 0.18,
};

const round99 = (n: number) => Math.max(1, Math.round(n) - 0.01);

function heuristicPricing(msrp: number, condition: CardCondition) {
  const base = BASE_DISCOUNT[condition] ?? 0.25;
  const spread: Record<Tier, number> = {
    "quick-sale": base + 0.08,
    market: base,
    premium: Math.max(0.05, base - 0.08),
  };

  return {
    tiers: TIERS.map((tier) => ({
      tier,
      price: round99(msrp * (1 - spread[tier])),
      discountPercent: Math.round(spread[tier] * 100),
      note:
        tier === "quick-sale"
          ? "Prices under the field — clears stock fastest."
          : tier === "market"
            ? "Tracks the typical open-box rate for this grade."
            : "Holds margin; expect a longer time to sell.",
    })),
    recommendedTier: "market" as Tier,
    rationale: `Benchmark discount for ${CONDITIONS_API[condition].label.toLowerCase()} stock is about ${Math.round(base * 100)}% off MSRP. Estimated from condition and MSRP only — no live comparison data was used.`,
    confidence: "low" as const,
  };
}

function heuristicDescription(
  title: string,
  condition: CardCondition,
  msrp: number,
  price: number,
) {
  const info = CONDITIONS_API[condition];
  const savings = Math.max(0, Math.round(msrp - price));

  return {
    headline: `${title} — ${info.label}`,
    description:
      `${title} in ${info.label.toLowerCase()} condition. ${info.description} ` +
      `Listed at $${Math.round(price)} against an MSRP of $${Math.round(msrp)}, a saving of $${savings}.` +
      `\n\nEvery listing on ReSmart is condition-graded before it goes live, and this one is covered by a ${info.warranty.toLowerCase()}.`,
    bullets: [
      info.label,
      `Save $${savings} versus MSRP`,
      info.warranty,
      "Condition verified before listing",
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

type Body = {
  task?: unknown;
  title?: unknown;
  condition?: unknown;
  msrp?: unknown;
  price?: unknown;
};

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "invalid_request", details: ["Body must be JSON."] },
      { status: 400, headers: NO_STORE },
    );
  }

  const task = body.task;
  const details: string[] = [];

  if (task !== "price" && task !== "description") {
    details.push('task must be "price" or "description".');
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) details.push("title is required.");

  const condition =
    typeof body.condition === "string" && body.condition in CONDITIONS_API
      ? (body.condition as CardCondition)
      : null;
  if (!condition) details.push("condition is required and must be a known grade.");

  const msrp = Number(body.msrp);
  if (!Number.isFinite(msrp) || msrp <= 0) {
    details.push("msrp must be a positive number.");
  }

  const price = Number(body.price);
  if (task === "description" && (!Number.isFinite(price) || price <= 0)) {
    details.push("price is required to write a description.");
  }

  if (details.length > 0 || !condition) {
    return NextResponse.json(
      { error: "invalid_request", details },
      { status: 400, headers: NO_STORE },
    );
  }

  // No key configured: answer from the heuristic instead of failing the
  // button. The response is labelled so the UI can say where it came from.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        source: "heuristic",
        task,
        result:
          task === "price"
            ? heuristicPricing(msrp, condition)
            : heuristicDescription(title, condition, msrp, price),
      },
      { headers: NO_STORE },
    );
  }

  const info = CONDITIONS_API[condition];
  const prompt =
    task === "price"
      ? `Recommend open-box pricing tiers for this listing.

Item: ${title}
Condition: ${info.label} — ${info.description}
Manufacturer's suggested retail price: $${msrp}

Return one entry per tier (quick-sale, market, premium), each at or below MSRP, and say which tier you recommend.`
      : `Write the customer-facing description for this listing.

Item: ${title}
Condition: ${info.label} — ${info.description}
Warranty: ${info.warranty}
MSRP: $${msrp}
Listed price: $${price}

Describe only what is stated above.`;

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      output_config: {
        // Small, well-specified tasks — low effort keeps the button snappy.
        effort: "low",
        format: {
          type: "json_schema",
          schema: task === "price" ? PRICE_SCHEMA : DESCRIPTION_SCHEMA,
        },
      },
      messages: [{ role: "user", content: prompt }],
    });

    // A decline returns HTTP 200 with empty/partial content, so stop_reason
    // has to be checked before reading the blocks.
    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        {
          error: "refused",
          message: "The model declined this request.",
          category: response.stop_details?.category ?? null,
        },
        { status: 422, headers: NO_STORE },
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
        { status: 502, headers: NO_STORE },
      );
    }

    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      // Structured outputs make this near-impossible, but a max_tokens cutoff
      // can still truncate the JSON mid-object.
      return NextResponse.json(
        {
          error: "malformed_output",
          message: "The model's response was not valid JSON.",
          stopReason: response.stop_reason,
        },
        { status: 502, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      {
        source: "claude",
        model: response.model,
        task,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        result,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many requests. Retry shortly." },
        { status: 429, headers: NO_STORE },
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "auth_failed", message: "Invalid ANTHROPIC_API_KEY." },
        { status: 500, headers: NO_STORE },
      );
    }
    if (error instanceof Anthropic.BadRequestError) {
      return NextResponse.json(
        { error: "bad_request", message: error.message },
        { status: 400, headers: NO_STORE },
      );
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return NextResponse.json(
        {
          error: "upstream_unreachable",
          message: "Could not reach the Claude API.",
        },
        { status: 504, headers: NO_STORE },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: "upstream_error", message: error.message },
        { status: 502, headers: NO_STORE },
      );
    }
    throw error;
  }
}
