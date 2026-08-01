import { NextResponse } from "next/server";
import { requireAdmin, type AdminActor } from "@/lib/admin-auth";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  MOCK_FINANCIALS,
  SETTING_BOUNDS,
  computeFinancials,
} from "@/lib/mock-admin";

/**
 * Admin API. Every method requires an admin credential — see lib/admin-auth.
 *
 *   GET  /api/admin                  → platform financial metrics
 *   POST /api/admin  { action: … }   → approve_merchant | reject_merchant
 *                                      | update_settings
 */

export const dynamic = "force-dynamic";

const round = (n: number) => Math.round(n);

/* ------------------------------------------------------------------ */
/* GET — financial metrics                                             */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  // Without Supabase, serve the mock figures the dashboard already renders —
  // labelled, so a caller can't mistake them for real books.
  if (!isSupabaseConfigured) {
    const f = computeFinancials(MOCK_FINANCIALS);
    return NextResponse.json({
      source: "mock",
      period: { label: MOCK_FINANCIALS.periodLabel, start, end },
      metrics: {
        gmv: MOCK_FINANCIALS.gmv,
        vipAttributedGmv: MOCK_FINANCIALS.vipAttributedGmv,
        salesCommission: f.salesCommission,
        vipSubscribers: MOCK_FINANCIALS.vipSubscribers,
        vipRevenue: f.vipRevenue,
        cpcAdRevenue: MOCK_FINANCIALS.cpcAdRevenue,
        cashbackPaidOut: f.cashbackPaidOut,
        grossRevenue: f.grossRevenue,
        netRevenue: f.netRevenue,
      },
      rates: {
        commissionRate: MOCK_FINANCIALS.recordedCommissionRate,
        vipFee: MOCK_FINANCIALS.recordedVipFee,
        cashbackRate: MOCK_FINANCIALS.recordedCashbackRate,
      },
    });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .rpc("get_platform_financials", {
      p_start: start ?? undefined,
      p_end: end ?? undefined,
    })
    .single<{
      period_start: string;
      period_end: string;
      gmv_cents: number;
      vip_attributed_gmv_cents: number;
      sales_commission_cents: number;
      vip_subscribers: number;
      vip_revenue_cents: number;
      cpc_ad_revenue_cents: number;
      cashback_paid_cents: number;
      net_revenue_cents: number;
    }>();

  if (error) {
    return NextResponse.json(
      { error: "query_failed", message: error.message },
      { status: 502 },
    );
  }

  const { data: settings } = await supabase
    .from("platform_settings")
    .select("vip_fee_cents, cashback_rate, default_commission_rate")
    .single();

  // The DB works in cents; the API surface is dollars.
  const toUsd = (cents: number) => cents / 100;

  return NextResponse.json({
    source: "supabase",
    period: { start: data.period_start, end: data.period_end },
    metrics: {
      gmv: toUsd(data.gmv_cents),
      vipAttributedGmv: toUsd(data.vip_attributed_gmv_cents),
      salesCommission: toUsd(data.sales_commission_cents),
      vipSubscribers: data.vip_subscribers,
      vipRevenue: toUsd(data.vip_revenue_cents),
      cpcAdRevenue: toUsd(data.cpc_ad_revenue_cents),
      cashbackPaidOut: toUsd(data.cashback_paid_cents),
      grossRevenue: toUsd(
        data.sales_commission_cents +
          data.vip_revenue_cents +
          data.cpc_ad_revenue_cents,
      ),
      netRevenue: toUsd(data.net_revenue_cents),
    },
    settings: settings
      ? {
          vipFee: toUsd(settings.vip_fee_cents),
          cashbackRate: Number(settings.cashback_rate),
          commissionRate: Number(settings.default_commission_rate),
        }
      : null,
  });
}

/* ------------------------------------------------------------------ */
/* POST — mutations                                                    */
/* ------------------------------------------------------------------ */

type Body = {
  action?: string;
  merchantId?: string;
  reason?: string;
  settings?: {
    vipFee?: number;
    cashbackRate?: number;
    commissionRate?: number;
  };
};

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // Mutations must never fake success. Reads can fall back to mock data;
  // writes cannot.
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "Supabase is not configured. Mutations are unavailable — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Body must be JSON." },
      { status: 400 },
    );
  }

  switch (body.action) {
    case "approve_merchant":
      return decideMerchant(body, auth.actor, "approved");
    case "reject_merchant":
      return decideMerchant(body, auth.actor, "rejected");
    case "update_settings":
      return updateSettings(body, auth.actor);
    default:
      return NextResponse.json(
        {
          error: "invalid_request",
          message:
            "`action` must be approve_merchant, reject_merchant, or update_settings.",
        },
        { status: 400 },
      );
  }
}

async function decideMerchant(
  body: Body,
  actor: AdminActor,
  to: "approved" | "rejected",
) {
  if (!body.merchantId) {
    return NextResponse.json(
      { error: "invalid_request", message: "`merchantId` is required." },
      { status: 400 },
    );
  }

  const reason = body.reason?.trim() ?? "";
  if (to === "rejected" && !reason) {
    // A rejection without a reason produces a support ticket, not a fix.
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "`reason` is required when rejecting a merchant.",
      },
      { status: 400 },
    );
  }

  const supabase = getServiceClient();

  const { data: merchant, error: readError } = await supabase
    .from("merchants")
    .select("id, status, business_name, doc_business_license, doc_tax_id, doc_reseller_cert")
    .eq("id", body.merchantId)
    .single();

  if (readError || !merchant) {
    return NextResponse.json(
      { error: "not_found", message: "No merchant with that id." },
      { status: 404 },
    );
  }

  if (merchant.status !== "pending") {
    return NextResponse.json(
      {
        error: "conflict",
        message: `Merchant is already ${merchant.status}.`,
      },
      { status: 409 },
    );
  }

  // Same gate the admin UI enforces, applied server-side so a direct API
  // call can't approve a merchant with a rejected or missing document.
  if (to === "approved") {
    const blocking = (
      [
        ["business license", merchant.doc_business_license],
        ["tax ID", merchant.doc_tax_id],
        ["reseller certificate", merchant.doc_reseller_cert],
      ] as const
    ).filter(([, s]) => s === "missing" || s === "rejected");

    if (blocking.length > 0) {
      return NextResponse.json(
        {
          error: "documents_incomplete",
          message: `Cannot approve: ${blocking.map(([n]) => n).join(", ")} not verified.`,
        },
        { status: 422 },
      );
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("merchants")
    .update({
      status: to,
      reviewed_at: new Date().toISOString(),
      reviewed_by: actor.kind === "user" ? actor.id : null,
      rejection_reason: to === "rejected" ? reason : null,
    })
    .eq("id", merchant.id)
    // Guard against two admins deciding the same application concurrently.
    .eq("status", "pending")
    .select("id, business_name, status, reviewed_at")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      {
        error: "update_failed",
        message: updateError?.message ?? "Merchant was decided concurrently.",
      },
      { status: 409 },
    );
  }

  await supabase.from("merchant_approval_events").insert({
    merchant_id: merchant.id,
    actor_id: actor.kind === "user" ? actor.id : null,
    from_status: "pending",
    to_status: to,
    reason: reason || null,
  });

  return NextResponse.json({ ok: true, merchant: updated });
}

async function updateSettings(body: Body, actor: AdminActor) {
  const patch = body.settings;
  if (!patch || Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "invalid_request", message: "`settings` is required." },
      { status: 400 },
    );
  }

  const errors: string[] = [];
  const inRange = (
    v: number | undefined,
    b: { min: number; max: number },
    name: string,
  ) => {
    if (v === undefined) return;
    if (typeof v !== "number" || Number.isNaN(v)) {
      errors.push(`${name} must be a number.`);
    } else if (v < b.min || v > b.max) {
      errors.push(`${name} must be between ${b.min} and ${b.max}.`);
    }
  };

  inRange(patch.vipFee, SETTING_BOUNDS.vipFee, "vipFee");
  inRange(patch.cashbackRate, SETTING_BOUNDS.cashbackRate, "cashbackRate");
  inRange(patch.commissionRate, SETTING_BOUNDS.commissionRate, "commissionRate");

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "invalid_request", details: errors },
      { status: 400 },
    );
  }

  const supabase = getServiceClient();

  const { data: current, error: readError } = await supabase
    .from("platform_settings")
    .select("vip_fee_cents, cashback_rate, default_commission_rate")
    .eq("id", true)
    .single();

  if (readError || !current) {
    return NextResponse.json(
      { error: "query_failed", message: readError?.message ?? "No settings row." },
      { status: 502 },
    );
  }

  const next = {
    vip_fee_cents:
      patch.vipFee !== undefined
        ? round(patch.vipFee * 100)
        : current.vip_fee_cents,
    cashback_rate: patch.cashbackRate ?? Number(current.cashback_rate),
    default_commission_rate:
      patch.commissionRate ?? Number(current.default_commission_rate),
  };

  if (next.cashback_rate > next.default_commission_rate) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message:
          "cashbackRate cannot exceed commissionRate — every sale would pay out more than it earns.",
      },
      { status: 422 },
    );
  }

  const { data: saved, error: writeError } = await supabase
    .from("platform_settings")
    .update({
      ...next,
      updated_by: actor.kind === "user" ? actor.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .select("vip_fee_cents, cashback_rate, default_commission_rate, updated_at")
    .single();

  if (writeError || !saved) {
    return NextResponse.json(
      { error: "update_failed", message: writeError?.message ?? "Update failed." },
      { status: 502 },
    );
  }

  // Append-only audit of what actually changed.
  const audit = (
    [
      ["vip_fee_cents", current.vip_fee_cents, saved.vip_fee_cents],
      ["cashback_rate", Number(current.cashback_rate), Number(saved.cashback_rate)],
      [
        "default_commission_rate",
        Number(current.default_commission_rate),
        Number(saved.default_commission_rate),
      ],
    ] as const
  )
    .filter(([, oldV, newV]) => oldV !== newV)
    .map(([field, oldV, newV]) => ({
      changed_by: actor.kind === "user" ? actor.id : null,
      field,
      old_value: oldV,
      new_value: newV,
    }));

  if (audit.length > 0) await supabase.from("settings_audit").insert(audit);

  return NextResponse.json({
    ok: true,
    changed: audit.map((a) => a.field),
    settings: {
      vipFee: saved.vip_fee_cents / 100,
      cashbackRate: Number(saved.cashback_rate),
      commissionRate: Number(saved.default_commission_rate),
      updatedAt: saved.updated_at,
    },
  });
}
