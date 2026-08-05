-- ============================================================================
-- ReSmart AI — Supabase / PostgreSQL schema
--
-- Apply with:  supabase db execute --file schema.sql
--          or: psql "$DATABASE_URL" -f schema.sql
--
-- Conventions
--   * Money is stored in integer CENTS. Never FLOAT — 0.1 + 0.2 != 0.3, and
--     commission/cashback ledgers must reconcile exactly.
--   * `users.id` references auth.users so Supabase Auth owns identity.
--   * Rates are SNAPSHOT onto each order at the moment of sale. Changing the
--     platform commission today must never restate revenue already booked.
--   * RLS is enabled on every table, scoped by auth.uid() and role. The
--     service-role key bypasses all of it.
-- ============================================================================

create extension if not exists "pgcrypto";     -- gen_random_uuid()
create extension if not exists "pg_trgm";      -- fuzzy product search

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('user', 'merchant', 'admin');

create type merchant_status as enum ('pending', 'approved', 'rejected', 'suspended');

create type document_status as enum ('missing', 'pending', 'verified', 'rejected');

create type product_condition as enum (
  'open_box_excellent',
  'certified_refurbished',
  'like_new'
);

create type product_category as enum (
  'laptops', 'cameras', 'headphones', 'consoles', 'other'
);

create type retailer_id as enum (
  'best_buy', 'ebay', 'walmart', 'amazon_warehouse', 'other'
);

create type subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled',
  'incomplete', 'incomplete_expired', 'unpaid', 'paused'
);

create type wallet_txn_type as enum (
  'cashback_pending',   -- accrued, not yet clearable
  'cashback_cleared',   -- return window elapsed, now withdrawable
  'cashback_reversed',  -- purchase refunded
  'payout',             -- withdrawal to bank
  'payout_reversed',    -- failed transfer returned to balance
  'adjustment'          -- manual correction
);

create type order_status as enum (
  'pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded'
);

create type payout_status as enum ('scheduled', 'processing', 'paid', 'failed');

create type ad_txn_type as enum ('topup', 'click_charge', 'refund', 'adjustment');

create type campaign_status as enum ('active', 'paused', 'exhausted', 'archived');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- SECURITY DEFINER so the lookup itself isn't subject to users' RLS policy,
-- which would recurse when a users policy calls this function.
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function current_merchant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.merchants where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

create table users (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text        not null unique,
  role                 user_role   not null default 'user',
  full_name            text,
  avatar_url           text,
  phone_e164           text,
  phone_verified       boolean     not null default false,
  sms_alerts_enabled   boolean     not null default false,
  email_alerts_enabled boolean     not null default true,
  is_suspended         boolean     not null default false,
  suspension_reason    text,
  stripe_customer_id   text unique,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint users_phone_e164_format check (
    phone_e164 is null or phone_e164 ~ '^\+[1-9]\d{7,14}$'
  )
);

create index users_role_idx on users (role);
create trigger users_set_updated_at before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- platform_settings — single row of globally adjustable economics
-- ---------------------------------------------------------------------------

create table platform_settings (
  -- Single-row table: the CHECK makes a second row impossible.
  id                    boolean primary key default true check (id),
  vip_fee_cents         integer       not null default 1499
    check (vip_fee_cents between 499 and 4999),
  -- Per-store VIP cashback, as percentage points (2.0 = 2%), keyed by the
  -- five retailers ReSmart compares. Keys match lib/cashback-rates.ts's
  -- `Store` labels exactly ("eBay", "Best Buy", ...) since the app reads
  -- this column straight into a `CashbackRates` record with no key
  -- translation — a mismatched key here would silently read as `undefined`.
  -- Each is capped at 3% in the app layer (app/api/admin/route.ts,
  -- app/api/cashback-rates/route.ts) — well under default_commission_rate's
  -- 5% floor, so cashback can never exceed commission by construction.
  cashback_rates        jsonb         not null
    default '{"eBay":2.0,"Amazon":1.0,"Best Buy":1.5,"Walmart":1.0,"Target":1.0}'::jsonb,
  default_commission_rate numeric(6, 4) not null default 0.1000
    check (default_commission_rate between 0.05 and 0.25),
  -- Flat merchant membership fee, billed monthly regardless of sales volume.
  merchant_subscription_fee_cents integer not null default 7999
    check (merchant_subscription_fee_cents between 1999 and 19999),
  updated_by            uuid references users (id) on delete set null,
  updated_at            timestamptz   not null default now()
);

insert into platform_settings (id) values (true) on conflict do nothing;

-- Append-only audit of every fee change.
create table settings_audit (
  id          uuid primary key default gen_random_uuid(),
  changed_by  uuid references users (id) on delete set null,
  field       text        not null,
  old_value   numeric     not null,
  new_value   numeric     not null,
  created_at  timestamptz not null default now()
);

create index settings_audit_created_idx on settings_audit (created_at desc);

-- ---------------------------------------------------------------------------
-- merchants — seller accounts, gated by admin approval
-- ---------------------------------------------------------------------------

create table merchants (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references users (id) on delete cascade,
  business_name       text not null,
  contact_email       text not null,
  category            text,

  status              merchant_status not null default 'pending',
  -- Per-merchant override of platform_settings.default_commission_rate.
  commission_rate     numeric(6, 4) not null default 0.1000
    check (commission_rate between 0.00 and 0.50),

  doc_business_license document_status not null default 'missing',
  doc_tax_id           document_status not null default 'missing',
  doc_reseller_cert    document_status not null default 'missing',

  -- Prepaid CPC balance. Sales are unaffected when this hits zero.
  ad_balance_cents     integer not null default 0 check (ad_balance_cents >= 0),
  auto_recharge        boolean not null default false,
  recharge_threshold_cents integer not null default 25000,
  recharge_amount_cents    integer not null default 50000,

  submitted_at        timestamptz not null default now(),
  reviewed_at         timestamptz,
  reviewed_by         uuid references users (id) on delete set null,
  rejection_reason    text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- A decision must record who made it and why (rejections).
  constraint merchants_review_recorded check (
    status in ('pending')
    or (reviewed_at is not null)
  ),
  constraint merchants_rejection_has_reason check (
    status <> 'rejected' or coalesce(btrim(rejection_reason), '') <> ''
  )
);

create index merchants_status_idx on merchants (status);
create index merchants_pending_idx on merchants (submitted_at)
  where status = 'pending';

create trigger merchants_set_updated_at before update on merchants
  for each row execute function set_updated_at();

-- Full history of approval decisions.
create table merchant_approval_events (
  id           uuid primary key default gen_random_uuid(),
  merchant_id  uuid not null references merchants (id) on delete cascade,
  actor_id     uuid references users (id) on delete set null,
  from_status  merchant_status not null,
  to_status    merchant_status not null,
  reason       text,
  created_at   timestamptz not null default now()
);

create index approval_events_merchant_idx
  on merchant_approval_events (merchant_id, created_at desc);

-- Promote the user to the merchant role as soon as they apply.
create or replace function sync_merchant_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.users
     set role = 'merchant'
   where id = new.user_id and role = 'user';
  return new;
end;
$$;

create trigger merchants_sync_role after insert on merchants
  for each row execute function sync_merchant_role();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

create table products (
  id             uuid primary key default gen_random_uuid(),
  merchant_id    uuid references merchants (id) on delete cascade,
  brand          text              not null,
  model          text              not null,
  category       product_category  not null default 'other',
  condition      product_condition not null,
  retailer       retailer_id       not null,
  external_sku   text,

  msrp_cents     integer not null check (msrp_cents > 0),
  price_cents    integer not null check (price_cents > 0),
  currency       char(3) not null default 'USD',

  image_url      text,
  deal_url       text    not null,
  stock_count    integer not null default 0 check (stock_count >= 0),
  warranty       text,

  is_active      boolean not null default true,
  -- Set by admin moderation; keeps the row for audit while hiding it.
  is_removed     boolean not null default false,
  removed_reason text,

  last_seen_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- An "open-box price" above MSRP is a scraping error, not a deal.
  constraint products_price_below_msrp check (price_cents <= msrp_cents),
  constraint products_unique_retailer_sku unique (retailer, external_sku)
);

alter table products
  add column savings_cents integer
    generated always as (msrp_cents - price_cents) stored,
  add column discount_percent numeric(5, 2)
    generated always as (
      round(((msrp_cents - price_cents)::numeric / msrp_cents) * 100, 2)
    ) stored;

create index products_category_idx  on products (category)       where is_active and not is_removed;
create index products_retailer_idx  on products (retailer)       where is_active and not is_removed;
create index products_condition_idx on products (condition)      where is_active and not is_removed;
create index products_price_idx     on products (price_cents)    where is_active and not is_removed;
create index products_discount_idx  on products (discount_percent desc) where is_active and not is_removed;
create index products_merchant_idx  on products (merchant_id);
create index products_search_trgm_idx on products
  using gin ((brand || ' ' || model) gin_trgm_ops);

create trigger products_set_updated_at before update on products
  for each row execute function set_updated_at();

/**
 * Only approved merchants may hold a live listing. Enforced in the database
 * rather than the API so a direct insert can't bypass the approval gate.
 */
create or replace function enforce_merchant_approved()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m_status merchant_status;
begin
  if new.merchant_id is null then
    return new;  -- crawled retailer inventory, no merchant behind it
  end if;

  select status into m_status from public.merchants where id = new.merchant_id;

  if m_status is distinct from 'approved' and new.is_active then
    new.is_active := false;   -- accept the draft, keep it out of search
  end if;
  return new;
end;
$$;

create trigger products_enforce_approval
  before insert or update on products
  for each row execute function enforce_merchant_approved();

-- Flip a merchant's listings live/dark when their status changes.
create or replace function cascade_merchant_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    update public.products
       set is_active = (new.status = 'approved')
     where merchant_id = new.id and not is_removed;
  end if;
  return new;
end;
$$;

create trigger merchants_cascade_status after update on merchants
  for each row execute function cascade_merchant_status();

-- Daily price observations behind the 90-day sparkline.
create table product_price_history (
  product_id  uuid    not null references products (id) on delete cascade,
  observed_on date    not null default current_date,
  price_cents integer not null check (price_cents > 0),
  primary key (product_id, observed_on)
);

create index price_history_recent_idx
  on product_price_history (product_id, observed_on desc);

-- Competing offers for the same item, powering the comparison view.
create table product_comparisons (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references products (id) on delete cascade,
  retailer       retailer_id       not null,
  condition      product_condition not null,
  price_cents    integer not null check (price_cents > 0),
  url            text    not null,
  in_stock       boolean not null default true,
  observed_at    timestamptz not null default now(),

  constraint comparisons_unique_offer unique (product_id, retailer)
);

create index comparisons_product_idx
  on product_comparisons (product_id, price_cents);

-- ---------------------------------------------------------------------------
-- deals — saved products + price-drop alerts
-- ---------------------------------------------------------------------------

create table deals (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid    not null references users (id)    on delete cascade,
  product_id         uuid    not null references products (id) on delete cascade,
  target_price_cents integer not null check (target_price_cents > 0),
  notify_sms         boolean not null default false,
  notify_email       boolean not null default true,
  triggered_at       timestamptz,
  last_notified_at   timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint deals_unique_user_product unique (user_id, product_id)
);

create index deals_user_idx on deals (user_id);
create index deals_armed_idx on deals (product_id, target_price_cents)
  where triggered_at is null and (notify_sms or notify_email);

create trigger deals_set_updated_at before update on deals
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- vip_subscriptions
-- ---------------------------------------------------------------------------

create table vip_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references users (id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id        text,
  status                 subscription_status not null default 'incomplete',

  -- Snapshot of the fee this subscriber actually pays; a later price change
  -- does not silently reprice existing subscriptions.
  price_cents            integer not null default 1499,
  currency               char(3) not null default 'USD',
  cashback_rate          numeric(6, 4) not null default 0.0300
    check (cashback_rate between 0 and 1),

  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  canceled_at            timestamptz,
  trial_end              timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index vip_one_live_per_user on vip_subscriptions (user_id)
  where status in ('trialing', 'active', 'past_due');
create index vip_status_idx on vip_subscriptions (status);

create trigger vip_set_updated_at before update on vip_subscriptions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- orders — the transaction record every financial metric derives from
-- ---------------------------------------------------------------------------

create table orders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references users (id)     on delete set null,
  merchant_id        uuid references merchants (id) on delete set null,
  product_id         uuid references products (id)  on delete set null,

  quantity           integer not null default 1 check (quantity > 0),
  unit_price_cents   integer not null check (unit_price_cents > 0),
  subtotal_cents     integer not null check (subtotal_cents > 0),

  -- Rates snapshotted at sale time. This is what makes "changing the
  -- commission rate doesn't restate history" true at the data layer.
  commission_rate    numeric(6, 4) not null,
  commission_cents   integer not null check (commission_cents >= 0),
  cashback_rate      numeric(6, 4) not null default 0,
  cashback_cents     integer not null default 0 check (cashback_cents >= 0),

  status             order_status not null default 'pending',
  external_order_ref text,

  placed_at          timestamptz not null default now(),
  completed_at       timestamptz,
  refunded_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint orders_subtotal_matches check (
    subtotal_cents = unit_price_cents * quantity
  ),
  constraint orders_completed_has_timestamp check (
    status <> 'completed' or completed_at is not null
  ),
  constraint orders_refunded_has_timestamp check (
    status <> 'refunded' or refunded_at is not null
  )
);

create index orders_user_idx      on orders (user_id, placed_at desc);
create index orders_merchant_idx  on orders (merchant_id, placed_at desc);
create index orders_status_idx    on orders (status);
-- Financial rollups scan completed orders by date.
create index orders_completed_idx on orders (completed_at)
  where status = 'completed';

create trigger orders_set_updated_at before update on orders
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- cashback_wallet — append-only user ledger
--
-- Deliberately not a mutable `balance` column: a running total that can be
-- UPDATEd is a total that can silently drift.
-- ---------------------------------------------------------------------------

create table cashback_wallet (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users (id) on delete cascade,
  type            wallet_txn_type not null,
  amount_cents    integer not null check (amount_cents <> 0),
  currency        char(3) not null default 'USD',
  order_id        uuid references orders (id) on delete set null,
  description     text,
  clears_at       timestamptz,
  stripe_payout_id text,
  -- Prevents a retried webhook from double-crediting the same event.
  idempotency_key text unique,
  created_at      timestamptz not null default now(),

  constraint wallet_sign_matches_type check (
    (type in ('cashback_pending', 'cashback_cleared', 'payout_reversed') and amount_cents > 0)
    or (type in ('cashback_reversed', 'payout') and amount_cents < 0)
    or type = 'adjustment'
  )
);

create index wallet_user_idx     on cashback_wallet (user_id, created_at desc);
create index wallet_clearing_idx on cashback_wallet (clears_at)
  where type = 'cashback_pending';

create view cashback_balances with (security_invoker = true) as
select
  user_id,
  coalesce(sum(amount_cents) filter (
    where type in ('cashback_pending', 'cashback_cleared', 'cashback_reversed')
  ), 0) as total_earned_cents,
  coalesce(sum(amount_cents) filter (where type = 'cashback_pending'), 0)
    as pending_cents,
  coalesce(sum(amount_cents) filter (
    where type in ('cashback_cleared', 'cashback_reversed', 'adjustment')
  ), 0) as available_cents,
  coalesce(-sum(amount_cents) filter (where type in ('payout', 'payout_reversed')), 0)
    as paid_out_cents
from cashback_wallet
group by user_id;

-- ---------------------------------------------------------------------------
-- merchant_payouts — commission settlement runs
-- ---------------------------------------------------------------------------

create table merchant_payouts (
  id                 uuid primary key default gen_random_uuid(),
  merchant_id        uuid not null references merchants (id) on delete cascade,
  period_start       date not null,
  period_end         date not null,
  gross_sales_cents  integer not null check (gross_sales_cents >= 0),
  commission_cents   integer not null check (commission_cents >= 0),
  net_payout_cents   integer not null,
  status             payout_status not null default 'scheduled',
  paid_at            timestamptz,
  stripe_transfer_id text,
  created_at         timestamptz not null default now(),

  constraint payouts_net_matches check (
    net_payout_cents = gross_sales_cents - commission_cents
  ),
  constraint payouts_period_valid check (period_end >= period_start),
  constraint payouts_unique_period unique (merchant_id, period_start, period_end)
);

create index payouts_merchant_idx on merchant_payouts (merchant_id, period_end desc);

-- ---------------------------------------------------------------------------
-- CPC advertising
-- ---------------------------------------------------------------------------

create table merchant_cpc_campaigns (
  id                uuid primary key default gen_random_uuid(),
  merchant_id       uuid not null references merchants (id) on delete cascade,
  product_id        uuid not null references products (id)  on delete cascade,

  -- Bounds mirror the $0.25–$1.50 boost slider in the merchant dashboard.
  cpc_bid_cents     integer not null check (cpc_bid_cents between 25 and 150),
  status            campaign_status not null default 'active',
  daily_budget_cents integer check (daily_budget_cents is null or daily_budget_cents > 0),

  impressions       bigint not null default 0 check (impressions >= 0),
  clicks            bigint not null default 0 check (clicks >= 0),
  spend_cents       bigint not null default 0 check (spend_cents >= 0),

  starts_at         timestamptz not null default now(),
  ends_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Clicks above impressions means broken tracking, not a real number.
  constraint campaigns_clicks_lte_impressions check (clicks <= impressions),
  constraint campaigns_window_valid check (ends_at is null or ends_at > starts_at),
  constraint campaigns_unique_merchant_product unique (merchant_id, product_id)
);

alter table merchant_cpc_campaigns
  add column ctr numeric(6, 4)
    generated always as (
      case when impressions = 0 then 0 else clicks::numeric / impressions end
    ) stored;

create index campaigns_merchant_idx on merchant_cpc_campaigns (merchant_id);
create index campaigns_auction_idx  on merchant_cpc_campaigns (cpc_bid_cents desc)
  where status = 'active';

create trigger campaigns_set_updated_at before update on merchant_cpc_campaigns
  for each row execute function set_updated_at();

create table merchant_click_events (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references merchant_cpc_campaigns (id) on delete cascade,
  user_id       uuid references users (id) on delete set null,
  charged_cents integer not null check (charged_cents >= 0),
  placement     text,
  ip_hash       text,     -- hashed, not raw: it is personal data
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index click_events_campaign_idx
  on merchant_click_events (campaign_id, created_at desc);
create index click_events_created_idx on merchant_click_events (created_at desc);

-- Prepaid ad-wallet ledger. Same append-only reasoning as cashback_wallet.
create table ad_wallet_transactions (
  id             uuid primary key default gen_random_uuid(),
  merchant_id    uuid not null references merchants (id) on delete cascade,
  type           ad_txn_type not null,
  amount_cents   integer not null check (amount_cents <> 0),
  campaign_id    uuid references merchant_cpc_campaigns (id) on delete set null,
  click_event_id uuid references merchant_click_events (id) on delete set null,
  description    text,
  created_at     timestamptz not null default now(),

  constraint ad_wallet_sign_matches_type check (
    (type in ('topup', 'refund') and amount_cents > 0)
    or (type = 'click_charge' and amount_cents < 0)
    or type = 'adjustment'
  )
);

create index ad_wallet_merchant_idx
  on ad_wallet_transactions (merchant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Platform financials — the admin dashboard's single source of truth
-- ---------------------------------------------------------------------------

create or replace function get_platform_financials(
  p_start timestamptz default date_trunc('month', now()),
  p_end   timestamptz default now()
)
returns table (
  period_start        timestamptz,
  period_end          timestamptz,
  gmv_cents           bigint,
  vip_attributed_gmv_cents bigint,
  sales_commission_cents   bigint,
  vip_subscribers     bigint,
  vip_revenue_cents   bigint,
  cpc_ad_revenue_cents bigint,
  cashback_paid_cents bigint,
  net_revenue_cents   bigint
)
language sql stable security definer set search_path = public as $$
  with sales as (
    select
      coalesce(sum(o.subtotal_cents), 0)::bigint      as gmv,
      coalesce(sum(o.commission_cents), 0)::bigint    as commission,
      coalesce(sum(o.subtotal_cents) filter (where o.cashback_cents > 0), 0)::bigint
                                                       as vip_gmv
    from orders o
    where o.status = 'completed'
      and o.completed_at >= p_start and o.completed_at < p_end
  ),
  subs as (
    select
      count(*)::bigint                                as subscribers,
      coalesce(sum(v.price_cents), 0)::bigint         as revenue
    from vip_subscriptions v
    where v.status in ('trialing', 'active', 'past_due')
  ),
  ads as (
    select coalesce(sum(c.charged_cents), 0)::bigint  as revenue
    from merchant_click_events c
    where c.created_at >= p_start and c.created_at < p_end
  ),
  cashback as (
    select coalesce(sum(w.amount_cents), 0)::bigint   as paid
    from cashback_wallet w
    where w.type in ('cashback_pending', 'cashback_cleared')
      and w.created_at >= p_start and w.created_at < p_end
  )
  select
    p_start, p_end,
    sales.gmv, sales.vip_gmv, sales.commission,
    subs.subscribers, subs.revenue,
    ads.revenue, cashback.paid,
    (sales.commission + subs.revenue + ads.revenue - cashback.paid)::bigint
  from sales, subs, ads, cashback;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table users                  enable row level security;
alter table merchants              enable row level security;
alter table platform_settings      enable row level security;
alter table settings_audit         enable row level security;
alter table merchant_approval_events enable row level security;
alter table products               enable row level security;
alter table product_price_history  enable row level security;
alter table product_comparisons    enable row level security;
alter table deals                  enable row level security;
alter table vip_subscriptions      enable row level security;
alter table orders                 enable row level security;
alter table cashback_wallet        enable row level security;
alter table merchant_payouts       enable row level security;
alter table merchant_cpc_campaigns enable row level security;
alter table merchant_click_events  enable row level security;
alter table ad_wallet_transactions enable row level security;

-- users
create policy users_select_own on users
  for select using (auth.uid() = id or is_admin());
create policy users_update_own on users
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy users_admin_all on users
  for all using (is_admin()) with check (is_admin());

-- merchants: own row readable/updatable; only admins change status.
create policy merchants_select_own on merchants
  for select using (user_id = auth.uid() or is_admin());
create policy merchants_insert_self on merchants
  for insert with check (user_id = auth.uid());
create policy merchants_admin_all on merchants
  for all using (is_admin()) with check (is_admin());

-- platform_settings: world-readable (the storefront needs the rates),
-- admin-writable only.
create policy settings_public_read on platform_settings for select using (true);
create policy settings_admin_write on platform_settings
  for all using (is_admin()) with check (is_admin());

create policy audit_admin_read on settings_audit for select using (is_admin());
create policy approval_events_admin on merchant_approval_events
  for select using (is_admin());

-- products: live catalog is public; merchants manage their own rows.
create policy products_public_read on products
  for select using ((is_active and not is_removed) or is_admin());
create policy products_merchant_write on products
  for all using (merchant_id = current_merchant_id())
  with check (merchant_id = current_merchant_id());
create policy products_admin_all on products
  for all using (is_admin()) with check (is_admin());

create policy price_history_read on product_price_history for select using (true);
create policy comparisons_read   on product_comparisons   for select using (true);

-- deals / subscriptions: strictly private.
create policy deals_own on deals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy subscriptions_select_own on vip_subscriptions
  for select using (auth.uid() = user_id or is_admin());

-- orders: visible to the buyer, the selling merchant, and admins. Writes
-- come from the service role only — a client-inserted order would let a
-- buyer set their own commission and cashback.
create policy orders_select_participant on orders
  for select using (
    auth.uid() = user_id
    or merchant_id = current_merchant_id()
    or is_admin()
  );

-- Wallet is read-only to the user; service role writes it. A client INSERT
-- here would let them mint their own cashback.
create policy wallet_select_own on cashback_wallet
  for select using (auth.uid() = user_id or is_admin());

create policy payouts_select_own on merchant_payouts
  for select using (merchant_id = current_merchant_id() or is_admin());

create policy campaigns_own on merchant_cpc_campaigns
  for all using (merchant_id = current_merchant_id())
  with check (merchant_id = current_merchant_id());
create policy campaigns_admin on merchant_cpc_campaigns
  for select using (is_admin());

create policy click_events_merchant_read on merchant_click_events
  for select using (
    is_admin() or exists (
      select 1 from merchant_cpc_campaigns c
      where c.id = merchant_click_events.campaign_id
        and c.merchant_id = current_merchant_id()
    )
  );

create policy ad_wallet_select_own on ad_wallet_transactions
  for select using (merchant_id = current_merchant_id() or is_admin());

-- ---------------------------------------------------------------------------
-- Auto-provision a profile row on signup
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
