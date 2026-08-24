create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  appointment_id text not null,
  professional_id text not null,
  client_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  currency text not null default 'cad',
  service_amount_cents integer not null check (service_amount_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  tip_cents integer not null default 0 check (tip_cents >= 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  total_paid_cents integer generated always as (service_amount_cents + tax_cents + tip_cents) stored,
  refund_service_cents integer not null default 0 check (refund_service_cents >= 0),
  refund_tax_cents integer not null default 0 check (refund_tax_cents >= 0),
  refund_tip_cents integer not null default 0 check (refund_tip_cents >= 0),
  status text not null default 'paid' check (status in ('pending', 'paid', 'partially_refunded', 'refunded', 'failed')),
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_records_professional_paid_at_idx
  on public.payment_records (professional_id, paid_at desc);

create index if not exists payment_records_appointment_idx
  on public.payment_records (appointment_id);

comment on table public.payment_records is
  'Frizi payment ledger. Tips are stored separately from service revenue and belong to the individual professional for portable earnings analytics.';

comment on column public.payment_records.tip_cents is
  'Optional gratuity collected with the payment but reported separately from service revenue for receipts, exports, refunds, and stylist-owned analytics.';
