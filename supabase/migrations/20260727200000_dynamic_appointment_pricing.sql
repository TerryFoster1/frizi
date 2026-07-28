create table if not exists public.frizi_services (
  id text primary key,
  professional_id text not null,
  salon_id text,
  name text not null,
  public_description text,
  base_price_cents integer not null check (base_price_cents >= 0),
  currency text not null default 'cad',
  taxable boolean not null default true,
  tip_eligible boolean not null default true,
  promotion_eligible boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_service_price_overrides (
  id uuid primary key default gen_random_uuid(),
  service_id text not null references public.frizi_services(id),
  professional_id text,
  salon_id text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'cad',
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.frizi_promotions (
  id text primary key,
  name text not null,
  public_description text,
  internal_description text,
  code text,
  discount_type text not null check (discount_type in ('percentage', 'fixed_amount')),
  discount_value integer not null check (discount_value >= 0),
  currency text not null default 'cad',
  applies_automatically boolean not null default false,
  requires_code boolean not null default false,
  start_at timestamptz,
  end_at timestamptz,
  active boolean not null default false,
  first_appointment_only boolean not null default false,
  new_clients_only boolean not null default false,
  returning_clients_only boolean not null default false,
  eligible_service_ids text[] not null default '{}',
  excluded_service_ids text[] not null default '{}',
  eligible_stylist_ids text[] not null default '{}',
  eligible_salon_ids text[] not null default '{}',
  minimum_subtotal_cents integer not null default 0 check (minimum_subtotal_cents >= 0),
  maximum_discount_cents integer check (maximum_discount_cents is null or maximum_discount_cents >= 0),
  total_redemption_limit integer check (total_redemption_limit is null or total_redemption_limit >= 0),
  per_customer_redemption_limit integer not null default 1 check (per_customer_redemption_limit >= 0),
  current_redemption_count integer not null default 0 check (current_redemption_count >= 0),
  combinable boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists frizi_promotions_code_unique_idx
  on public.frizi_promotions (upper(code))
  where code is not null;

create table if not exists public.frizi_promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id text not null references public.frizi_promotions(id),
  appointment_id text not null,
  customer_id text not null,
  professional_id text not null,
  salon_id text,
  status text not null default 'reserved' check (status in ('reserved', 'redeemed', 'released', 'refunded')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  discount_cents integer not null default 0 check (discount_cents >= 0),
  reserved_at timestamptz not null default now(),
  redeemed_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists frizi_promotion_redemptions_customer_limit_idx
  on public.frizi_promotion_redemptions (promotion_id, customer_id)
  where status in ('reserved', 'redeemed');

create table if not exists public.frizi_payment_snapshots (
  id uuid primary key default gen_random_uuid(),
  appointment_id text not null,
  customer_id text not null,
  professional_id text not null,
  salon_id text,
  stripe_checkout_session_id text unique,
  pricing_version text not null,
  snapshot_hash text not null,
  snapshot jsonb not null,
  quote_expires_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'paid', 'expired', 'cancelled', 'refunded')),
  created_at timestamptz not null default now()
);

create table if not exists public.frizi_deposit_payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id text not null,
  payment_record_id uuid references public.payment_records(id),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'cad',
  status text not null default 'paid' check (status in ('pending', 'paid', 'refunded', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.payment_records
  add column if not exists promotion_id text,
  add column if not exists promotion_redemption_id uuid,
  add column if not exists discount_cents integer not null default 0 check (discount_cents >= 0),
  add column if not exists deposit_credit_cents integer not null default 0 check (deposit_credit_cents >= 0),
  add column if not exists pricing_snapshot_id uuid,
  add column if not exists payment_method_label text,
  add column if not exists payment_source text not null default 'frizi' check (payment_source in ('frizi', 'external'));

comment on table public.frizi_payment_snapshots is
  'Immutable appointment pricing quote used for Stripe Checkout, receipts, refunds, and historical audit even if service prices or promotions later change.';

comment on table public.frizi_promotions is
  'Frizi-owned promotion system. Stripe Promotion Codes are optional and must not be required for Frizi-created appointment offers.';
