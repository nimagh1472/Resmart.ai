import { NextResponse } from "next/server";
import {
  CASHBACK_RATE_BOUNDS,
  CASHBACK_STORES,
  getCashbackRates,
  isValidCashbackRate,
  setCashbackRates,
  type CashbackRates,
} from "@/lib/cashback-rates";

/**
 * Per-store VIP cashback rates (eBay, Amazon, Best Buy, Walmart, Target).
 *
 * GET   /api/cashback-rates             — current rates, read by product and
 *                                          comparison pages
 * POST  /api/cashback-rates { rates }   — admin console save
 *
 * Backed by the in-memory store in `lib/cashback-rates.ts`, same pattern as
 * `/api/merchants` (`lib/merchant-store.ts`) — no auth gate, matching this
 * admin console's existing "demo data, no access control" scope (see
 * `components/admin/admin-dashboard.tsx`), so the Save button here takes
 * effect immediately without a signed-in admin session.
 */

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET() {
  return NextResponse.json({ rates: getCashbackRates() }, { headers: NO_STORE });
}

type Body = { rates?: Partial<Record<string, unknown>> };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Body must be JSON." },
      { status: 400 },
    );
  }

  const patch = body.rates;
  if (!patch || typeof patch !== "object") {
    return NextResponse.json(
      { error: "invalid_request", message: "`rates` is required." },
      { status: 400 },
    );
  }

  const errors: string[] = [];
  const validated: Partial<CashbackRates> = {};

  for (const store of CASHBACK_STORES) {
    if (!(store in patch)) continue;
    const value = patch[store];
    if (!isValidCashbackRate(value)) {
      errors.push(
        `${store} must be a number between ${CASHBACK_RATE_BOUNDS.min}% and ${CASHBACK_RATE_BOUNDS.max}%.`,
      );
      continue;
    }
    validated[store] = value;
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "invalid_request", details: errors }, { status: 400 });
  }

  const rates = setCashbackRates(validated);
  return NextResponse.json({ ok: true, rates }, { headers: NO_STORE });
}
