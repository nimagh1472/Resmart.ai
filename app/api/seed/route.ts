import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  SEED_ADMIN,
  SEED_MERCHANTS,
  SEED_PRODUCTS,
  SEED_SHOPPERS,
  SEED_WINDOW_DAYS,
  comparisonsFor,
  makeRng,
  orderCountFor,
} from "@/lib/seed-data";

/**
 * POST /api/seed — populate Supabase with demo data.
 *
 * Guarded twice: an admin credential, plus an explicit ALLOW_SEED=true. The
 * endpoint deletes and recreates accounts, so it must not be reachable by
 * accident in a deployed environment.
 *
 * Body: { reset?: boolean }  — reset (default true) removes prior seed rows.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cents = (usd: number) => Math.round(usd * 100);

/** Enum values in Postgres are snake_case; the TS catalog uses kebab-case. */
const dbCondition = (c: string) => c.replace(/-/g, "_");
const dbRetailer = (r: string) => r.replace(/-/g, "_");

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (process.env.ALLOW_SEED !== "true") {
    return NextResponse.json(
      {
        error: "seeding_disabled",
        message:
          "Set ALLOW_SEED=true to enable this endpoint. It deletes and recreates accounts.",
      },
      { status: 403 },
    );
  }

  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "Seeding needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  let reset = true;
  try {
    const body = await request.json();
    if (typeof body?.reset === "boolean") reset = body.reset;
  } catch {
    /* empty body is fine */
  }

  const supabase = getServiceClient();

  try {
    if (reset) await removeExistingSeed(supabase);

    /* -- accounts ------------------------------------------------- */

    const adminId = await createAccount(supabase, SEED_ADMIN);
    await supabase.from("users").update({ role: "admin" }).eq("id", adminId);

    const merchantRows: { id: string; userId: string }[] = [];
    for (const m of SEED_MERCHANTS) {
      const userId = await createAccount(supabase, m);
      const decided = m.status !== "pending";

      const { data, error } = await supabase
        .from("merchants")
        .insert({
          user_id: userId,
          business_name: m.businessName,
          contact_email: m.email,
          category: m.category,
          status: m.status,
          commission_rate: m.commissionRate,
          doc_business_license: m.docs.businessLicense,
          doc_tax_id: m.docs.taxId,
          doc_reseller_cert: m.docs.resellerCert,
          ad_balance_cents: cents(m.adBalance),
          auto_recharge: m.status === "approved",
          submitted_at: daysAgo(m.status === "approved" ? 120 : 3),
          // The CHECK constraint requires a reviewer on any decided row.
          reviewed_at: decided ? daysAgo(118) : null,
          reviewed_by: decided ? adminId : null,
        })
        .select("id")
        .single();

      if (error) throw new Error(`merchant ${m.businessName}: ${error.message}`);
      merchantRows.push({ id: data.id, userId });
    }

    const shopperIds: { id: string; vip: boolean }[] = [];
    for (const s of SEED_SHOPPERS) {
      const id = await createAccount(supabase, s);
      shopperIds.push({ id, vip: s.vip });

      if (s.vip) {
        const { error } = await supabase.from("vip_subscriptions").insert({
          user_id: id,
          status: "active",
          price_cents: 1499,
          cashback_rate: 0.03,
          current_period_start: daysAgo(12),
          current_period_end: daysAgo(-18),
          stripe_subscription_id: `sub_seed_${id.slice(0, 8)}`,
        });
        if (error) throw new Error(`subscription: ${error.message}`);
      }
    }

    /* -- products + comparisons ----------------------------------- */

    const productIds: { id: string; price: number; merchantId: string }[] = [];

    // Indexed loop rather than .entries() — tsconfig targets ES5.
    for (let i = 0; i < SEED_PRODUCTS.length; i++) {
      const p = SEED_PRODUCTS[i];
      const merchantId = merchantRows[p.merchantIndex].id;

      const { data, error } = await supabase
        .from("products")
        .insert({
          merchant_id: merchantId,
          brand: p.brand,
          model: p.model,
          category: p.category,
          condition: dbCondition(p.condition),
          retailer: dbRetailer(p.retailer),
          external_sku: `SEED-${String(i + 1).padStart(3, "0")}`,
          msrp_cents: cents(p.msrp),
          price_cents: cents(p.price),
          stock_count: p.stock,
          deal_url: p.dealUrl,
          warranty:
            p.condition === "certified-refurbished"
              ? "1-year manufacturer warranty"
              : "90-day retailer warranty",
          is_active: true,
        })
        .select("id")
        .single();

      if (error) throw new Error(`product ${p.model}: ${error.message}`);
      productIds.push({ id: data.id, price: p.price, merchantId });

      // 90 days of price history.
      const history = p.priceHistory.map((price, d) => ({
        product_id: data.id,
        observed_on: new Date(Date.now() - (89 - d) * 86_400_000)
          .toISOString()
          .slice(0, 10),
        price_cents: cents(price),
      }));
      const { error: histError } = await supabase
        .from("product_price_history")
        .insert(history);
      if (histError) throw new Error(`price history: ${histError.message}`);

      const { error: cmpError } = await supabase
        .from("product_comparisons")
        .insert(
          comparisonsFor(p).map((c) => ({
            product_id: data.id,
            retailer: dbRetailer(c.retailer),
            condition: dbCondition(c.condition),
            price_cents: cents(c.price),
            url: c.url,
            in_stock: c.inStock,
          })),
        );
      if (cmpError) throw new Error(`comparisons: ${cmpError.message}`);
    }

    /* -- orders, cashback, campaigns, clicks ---------------------- */

    const rng = makeRng(20260801);
    const orders: Record<string, unknown>[] = [];
    const wallet: Record<string, unknown>[] = [];

    for (let i = 0; i < SEED_PRODUCTS.length; i++) {
      const p = SEED_PRODUCTS[i];
      const product = productIds[i];
      const merchant = SEED_MERCHANTS[p.merchantIndex];
      const count = orderCountFor(p.price, rng);

      for (let n = 0; n < count; n++) {
        const buyer = shopperIds[Math.floor(rng() * shopperIds.length)];
        const placedDaysAgo = Math.floor(rng() * SEED_WINDOW_DAYS);
        const subtotal = cents(p.price);
        const commission = Math.round(subtotal * merchant.commissionRate);
        const cashback = buyer.vip ? Math.round(subtotal * 0.03) : 0;

        const orderId = crypto.randomUUID();
        orders.push({
          id: orderId,
          user_id: buyer.id,
          merchant_id: product.merchantId,
          product_id: product.id,
          quantity: 1,
          unit_price_cents: subtotal,
          subtotal_cents: subtotal,
          commission_rate: merchant.commissionRate,
          commission_cents: commission,
          cashback_rate: buyer.vip ? 0.03 : 0,
          cashback_cents: cashback,
          status: "completed",
          placed_at: daysAgo(placedDaysAgo + 1),
          completed_at: daysAgo(placedDaysAgo),
          external_order_ref: `SEED-ORD-${orderId.slice(0, 8)}`,
        });

        if (cashback > 0) {
          wallet.push({
            user_id: buyer.id,
            order_id: orderId,
            // Older purchases have cleared their return window.
            type: placedDaysAgo > 30 ? "cashback_cleared" : "cashback_pending",
            amount_cents: cashback,
            description: `${p.brand} ${p.model}`,
            clears_at: daysAgo(placedDaysAgo - 30),
            idempotency_key: `seed-cashback-${orderId}`,
            created_at: daysAgo(placedDaysAgo),
          });
        }
      }
    }

    const { error: orderError } = await supabase.from("orders").insert(orders);
    if (orderError) throw new Error(`orders: ${orderError.message}`);

    if (wallet.length > 0) {
      const { error: walletError } = await supabase
        .from("cashback_wallet")
        .insert(wallet);
      if (walletError) throw new Error(`cashback: ${walletError.message}`);
    }

    // Boost the first two listings of each approved merchant.
    const clicks: Record<string, unknown>[] = [];
    let campaignCount = 0;

    for (const m of [0, 1, 2] as const) {
      const owned = SEED_PRODUCTS.map((p, i) => ({ p, i }))
        .filter(({ p }) => p.merchantIndex === m)
        .slice(0, 2);

      for (const { i } of owned) {
        const bidCents = 40 + Math.floor(rng() * 80); // $0.40–$1.19
        const clickCount = 40 + Math.floor(rng() * 120);
        const impressions = clickCount * (18 + Math.floor(rng() * 30));

        const { data, error } = await supabase
          .from("merchant_cpc_campaigns")
          .insert({
            merchant_id: merchantRows[m].id,
            product_id: productIds[i].id,
            cpc_bid_cents: bidCents,
            status: "active",
            impressions,
            clicks: clickCount,
            spend_cents: clickCount * bidCents,
            starts_at: daysAgo(SEED_WINDOW_DAYS),
          })
          .select("id")
          .single();

        if (error) throw new Error(`campaign: ${error.message}`);
        campaignCount++;

        for (let c = 0; c < clickCount; c++) {
          clicks.push({
            campaign_id: data.id,
            charged_cents: bidCents,
            placement: "trending-deals",
            created_at: daysAgo(Math.floor(rng() * SEED_WINDOW_DAYS)),
          });
        }
      }
    }

    // Chunked: a single insert of several thousand rows can exceed the
    // PostgREST request limit.
    for (let i = 0; i < clicks.length; i += 500) {
      const { error } = await supabase
        .from("merchant_click_events")
        .insert(clicks.slice(i, i + 500));
      if (error) throw new Error(`clicks: ${error.message}`);
    }

    const gmv = orders.reduce((n, o) => n + (o.subtotal_cents as number), 0);
    const commission = orders.reduce(
      (n, o) => n + (o.commission_cents as number),
      0,
    );
    const adRevenue = clicks.reduce(
      (n, c) => n + (c.charged_cents as number),
      0,
    );

    return NextResponse.json({
      ok: true,
      password: SEED_ADMIN.password,
      created: {
        admin: 1,
        merchantsApproved: SEED_MERCHANTS.filter((m) => m.status === "approved")
          .length,
        merchantsPending: SEED_MERCHANTS.filter((m) => m.status === "pending")
          .length,
        shoppers: SEED_SHOPPERS.length,
        vipSubscriptions: SEED_SHOPPERS.filter((s) => s.vip).length,
        products: SEED_PRODUCTS.length,
        priceHistoryRows: SEED_PRODUCTS.length * 90,
        comparisons: SEED_PRODUCTS.length * 2,
        orders: orders.length,
        cashbackEntries: wallet.length,
        campaigns: campaignCount,
        clickEvents: clicks.length,
      },
      analytics: {
        gmv: gmv / 100,
        salesCommission: commission / 100,
        cpcAdRevenue: adRevenue / 100,
        vipMrr: (SEED_SHOPPERS.filter((s) => s.vip).length * 1499) / 100,
      },
    });
  } catch (error) {
    // Partial seeds are worse than none — say exactly where it stopped.
    return NextResponse.json(
      {
        error: "seed_failed",
        message: error instanceof Error ? error.message : String(error),
        hint: "Data may be partially written. Re-run with { \"reset\": true }.",
      },
      { status: 500 },
    );
  }
}

/* ------------------------------------------------------------------ */

const seedEmails = () => [
  SEED_ADMIN.email,
  ...SEED_MERCHANTS.map((m) => m.email),
  ...SEED_SHOPPERS.map((s) => s.email),
];

/**
 * Deleting the auth user cascades through public.users → merchants →
 * products → orders, so this clears every seeded row.
 */
async function removeExistingSeed(supabase: SupabaseClient) {
  const emails = new Set(seedEmails());
  let page = 1;

  // listUsers is paginated; a busy project can hold far more than one page.
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`listUsers: ${error.message}`);
    if (data.users.length === 0) break;

    for (const u of data.users) {
      if (u.email && emails.has(u.email)) {
        const { error: delError } = await supabase.auth.admin.deleteUser(u.id);
        if (delError) throw new Error(`deleteUser: ${delError.message}`);
      }
    }

    if (data.users.length < 200) break;
    page++;
  }
}

async function createAccount(
  supabase: SupabaseClient,
  person: { email: string; password: string; fullName: string },
): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: person.email,
    password: person.password,
    email_confirm: true,
    user_metadata: { full_name: person.fullName },
  });

  if (error || !data.user) {
    throw new Error(`createUser ${person.email}: ${error?.message ?? "unknown"}`);
  }

  // The on_auth_user_created trigger inserts the public.users row; make sure
  // the display name landed even if metadata handling changes.
  await supabase
    .from("users")
    .update({ full_name: person.fullName })
    .eq("id", data.user.id);

  return data.user.id;
}
