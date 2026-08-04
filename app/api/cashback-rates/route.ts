import { NextResponse } from "next/server";
import {
  CASHBACK_RATE_BOUNDS,
  CASHBACK_STORES,
  DEFAULT_CASHBACK_RATES,
  getCashbackRates,
  isValidCashbackRate,
  setCashbackRates,
  type CashbackRates,
} from "@/lib/cashback-rates";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Per-store VIP cashback rates (eBay, Amazon, Best Buy, Walmart, Target).
 *
 * GET   /api/cashback-rates             — current rates, read by product and
 *                                          comparison pages
 * POST  /api/cashback-rates { rates }   — admin console save
 *
 * Backed by Supabase's `platform_settings.cashback_rates` column when
 * configured, so a saved rate survives a redeploy/restart and is shared
 * across every server instance — not just the process that handled the
 * save. The in-memory store in `lib/cashback-rates.ts` (same pattern as
 * `/api/merchants`'s `lib/merchant-store.ts`) is both the pre-Supabase
 * fallback and a same-process read-through cache so product pages that call
 * `getCashbackRates()` directly (no HTTP round trip) still see the latest
 * value. No auth gate, matching this admin console's existing "demo data,
 * no access control" scope (see `components/admin/admin-dashboard.tsx`), so
 * the Save button here takes effect immediately without a signed-in admin
 * session.
 */

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Service-role writes need both the URL/anon key (isSupabaseConfigured) and the service key. */
const dbReady = () =>
  isSupabaseConfigured && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Layers whatever Supabase returns over the known defaults rather than
 * trusting it outright — a column that's missing a key (schema drift, a
 * hand-edited row) must never produce `undefined` for a store the UI
 * unconditionally renders a slider for.
 */
function mergeWithDefaults(raw: unknown): CashbackRates {
  const patch = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<string, unknown>>;
  const merged = { ...DEFAULT_CASHBACK_RATES };
  for (const store of CASHBACK_STORES) {
    const value = patch[store];
    if (isValidCashbackRate(value)) merged[store] = value;
  }
  return merged;
}

export async function GET() {
  if (dbReady()) {
    try {
      const supabase = getServiceClient();
      const { data, error } = await supabase
        .from("platform_settings")
        .select("cashback_rates")
        .eq("id", true)
        .single();

      if (!error && data) {
        const rates = mergeWithDefaults(data.cashback_rates);
        // Keeps direct in-process readers (e.g. the product page's
        // `getCashbackRates()` call) in sync with what Supabase holds.
        setCashbackRates(rates);
        return NextResponse.json({ rates }, { headers: NO_STORE });
      }
    } catch {
      // Supabase unreachable — fall through to the in-memory/default rates.
    }
  }

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

  // Apply in-memory immediately so the save always takes effect for this
  // process even if the Supabase write below fails or isn't configured —
  // a rate change should never silently no-op for the admin who just made it.
  const rates = setCashbackRates(validated);

  if (dbReady()) {
    try {
      const supabase = getServiceClient();
      const { data: current } = await supabase
        .from("platform_settings")
        .select("cashback_rates")
        .eq("id", true)
        .single();

      const merged = { ...mergeWithDefaults(current?.cashback_rates), ...validated };

      const { error } = await supabase
        .from("platform_settings")
        .update({ cashback_rates: merged, updated_at: new Date().toISOString() })
        .eq("id", true);

      if (!error) {
        setCashbackRates(merged);
        return NextResponse.json(
          { ok: true, rates: merged, persisted: true },
          { headers: NO_STORE },
        );
      }
    } catch {
      // Falls through — the in-memory rates set above still apply to this
      // process; the save just won't survive a restart until Supabase is
      // reachable again.
    }
  }

  return NextResponse.json({ ok: true, rates, persisted: false }, { headers: NO_STORE });
}
