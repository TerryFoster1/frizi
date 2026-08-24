-- Frizi Salon payments and POS foundation.
-- Salon payments belong to the salon merchant context. Independent Frizi Pro
-- bookings keep their existing professional merchant flow.

alter table public.frizi_salons
  add column if not exists stripe_connected_account_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists payments_status text not null default 'not_connected'
    check (payments_status in ('not_connected', 'onboarding', 'test_connected', 'active', 'restricted', 'disabled')),
  add column if not exists standard_payouts_enabled boolean not null default true,
  add column if not exists instant_payouts_enabled boolean not null default false,
  add column if not exists payments_updated_at timestamptz;

create table if not exists public.frizi_salon_tax_rules (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  location_id uuid references public.frizi_salon_locations(id) on delete cascade,
  name text not null default 'Default tax',
  jurisdiction text,
  tax_rate_basis_points integer not null default 0
    check (tax_rate_basis_points >= 0 and tax_rate_basis_points <= 10000),
  applies_to_services boolean not null default true,
  applies_to_products boolean not null default false,
  tax_registration_label text,
  tax_registration_number text,
  active boolean not null default true,
  effective_from date,
  effective_to date,
  created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create table if not exists public.frizi_salon_orders (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  salon_location_id uuid references public.frizi_salon_locations(id) on delete set null,
  appointment_id uuid references public.frizi_appointments(id) on delete set null,
  client_id uuid references public.frizi_clients(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'checkout_started', 'paid', 'partially_refunded', 'refunded', 'voided')),
  merchant_context text not null default 'salon'
    check (merchant_context in ('salon', 'professional')),
  payment_processor text not null default 'stripe'
    check (payment_processor in ('stripe', 'external_record')),
  payment_status text not null default 'not_started'
    check (payment_status in ('not_started', 'requires_payment_method', 'processing', 'paid', 'partially_refunded', 'refunded', 'failed', 'cancelled')),
  currency text not null default 'cad',
  service_subtotal_cents integer not null default 0 check (service_subtotal_cents >= 0),
  product_subtotal_cents integer not null default 0 check (product_subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  credit_cents integer not null default 0 check (credit_cents >= 0),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  taxable_service_cents integer not null default 0 check (taxable_service_cents >= 0),
  taxable_product_cents integer not null default 0 check (taxable_product_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  tip_cents integer not null default 0 check (tip_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  tax_rate_basis_points integer not null default 0 check (tax_rate_basis_points >= 0 and tax_rate_basis_points <= 10000),
  tax_rule_id uuid references public.frizi_salon_tax_rules(id) on delete set null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_customer_id text,
  stripe_connected_account_id text,
  stripe_latest_event_id text,
  payment_method_label text,
  receipt_url text,
  paid_at timestamptz,
  voided_at timestamptz,
  checkout_snapshot jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (merchant_context = 'salon'),
  check (total_cents = greatest(0, service_subtotal_cents + product_subtotal_cents - discount_cents - credit_cents + fee_cents + tax_cents + tip_cents)),
  check (refunded_cents <= total_cents)
);

create table if not exists public.frizi_salon_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.frizi_salon_orders(id) on delete cascade,
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  appointment_id uuid references public.frizi_appointments(id) on delete set null,
  service_id text references public.frizi_services(id) on delete set null,
  product_variant_id text references public.frizi_commerce_product_variants(id) on delete set null,
  item_type text not null
    check (item_type in ('service', 'product', 'discount', 'fee', 'credit')),
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_cents integer not null default 0 check (unit_amount_cents >= 0),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  staff_assignment_id uuid references public.frizi_salon_staff_assignments(id) on delete set null,
  professional_id uuid references public.frizi_professionals(id) on delete set null,
  item_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.frizi_salon_tip_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.frizi_salon_orders(id) on delete cascade,
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  appointment_id uuid references public.frizi_appointments(id) on delete set null,
  staff_assignment_id uuid references public.frizi_salon_staff_assignments(id) on delete set null,
  professional_id uuid references public.frizi_professionals(id) on delete set null,
  tip_cents integer not null check (tip_cents >= 0),
  currency text not null default 'cad',
  allocation_basis text not null default 'service_staff'
    check (allocation_basis in ('service_staff', 'manual_split', 'pooled')),
  created_at timestamptz not null default now()
);

create table if not exists public.frizi_salon_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.frizi_salon_orders(id) on delete cascade,
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'succeeded', 'failed', 'cancelled')),
  refund_type text not null default 'partial'
    check (refund_type in ('full', 'partial', 'service_only', 'tip_only', 'tax_adjustment')),
  amount_cents integer not null check (amount_cents > 0),
  service_amount_cents integer not null default 0 check (service_amount_cents >= 0),
  product_amount_cents integer not null default 0 check (product_amount_cents >= 0),
  tax_amount_cents integer not null default 0 check (tax_amount_cents >= 0),
  tip_amount_cents integer not null default 0 check (tip_amount_cents >= 0),
  reason text,
  stripe_refund_id text unique,
  stripe_payment_intent_id text,
  requested_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_salon_payment_events (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid references public.frizi_salons(id) on delete set null,
  order_id uuid references public.frizi_salon_orders(id) on delete set null,
  stripe_event_id text not null unique,
  event_type text not null,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  payload_summary jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.frizi_appointments
  add column if not exists salon_order_id uuid references public.frizi_salon_orders(id) on delete set null,
  add column if not exists salon_tip_cents integer not null default 0 check (salon_tip_cents >= 0);

create index if not exists frizi_salon_tax_rules_salon_active_idx
  on public.frizi_salon_tax_rules (salon_id, location_id, active);

create index if not exists frizi_salon_orders_salon_status_idx
  on public.frizi_salon_orders (salon_id, status, created_at desc);

create index if not exists frizi_salon_orders_client_idx
  on public.frizi_salon_orders (client_id, created_at desc)
  where client_id is not null;

create index if not exists frizi_salon_order_items_order_idx
  on public.frizi_salon_order_items (order_id);

create index if not exists frizi_salon_tip_allocations_staff_idx
  on public.frizi_salon_tip_allocations (staff_assignment_id, created_at desc)
  where staff_assignment_id is not null;

create index if not exists frizi_salon_refunds_order_idx
  on public.frizi_salon_refunds (order_id, status);

create index if not exists frizi_salon_payment_events_order_idx
  on public.frizi_salon_payment_events (order_id, received_at desc);

alter table public.frizi_salon_tax_rules enable row level security;
alter table public.frizi_salon_orders enable row level security;
alter table public.frizi_salon_order_items enable row level security;
alter table public.frizi_salon_tip_allocations enable row level security;
alter table public.frizi_salon_refunds enable row level security;
alter table public.frizi_salon_payment_events enable row level security;

create or replace function public.frizi_apply_salon_order_payment(
  target_order_id uuid,
  target_stripe_event_id text,
  target_stripe_payment_intent_id text,
  target_stripe_customer_id text default null,
  target_receipt_url text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_order public.frizi_salon_orders%rowtype;
begin
  select *
  into target_order
  from public.frizi_salon_orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Salon order not found.';
  end if;

  update public.frizi_salon_orders
  set status = 'paid',
      payment_status = 'paid',
      stripe_latest_event_id = target_stripe_event_id,
      stripe_payment_intent_id = coalesce(target_stripe_payment_intent_id, stripe_payment_intent_id),
      stripe_customer_id = coalesce(target_stripe_customer_id, stripe_customer_id),
      receipt_url = coalesce(target_receipt_url, receipt_url),
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
  where id = target_order_id;

  if target_order.appointment_id is not null then
    update public.frizi_appointments
    set payment_status = 'paid',
        salon_order_id = target_order_id,
        salon_tip_cents = target_order.tip_cents,
        updated_at = now()
    where id = target_order.appointment_id;
  end if;
end;
$$;

revoke all on function public.frizi_apply_salon_order_payment(uuid, text, text, text, text) from public;
grant execute on function public.frizi_apply_salon_order_payment(uuid, text, text, text, text) to service_role;

drop policy if exists "salon members can read tax rules" on public.frizi_salon_tax_rules;
create policy "salon members can read tax rules"
on public.frizi_salon_tax_rules
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "salon managers can manage tax rules" on public.frizi_salon_tax_rules;
create policy "salon managers can manage tax rules"
on public.frizi_salon_tax_rules
for all
to authenticated
using (public.frizi_can_manage_salon(salon_id))
with check (public.frizi_can_manage_salon(salon_id));

drop policy if exists "salon members can read orders" on public.frizi_salon_orders;
create policy "salon members can read orders"
on public.frizi_salon_orders
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "clients can read own salon orders" on public.frizi_salon_orders;
create policy "clients can read own salon orders"
on public.frizi_salon_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.frizi_clients client
    where client.id = frizi_salon_orders.client_id
      and client.profile_id = public.frizi_current_profile_id()
  )
);

drop policy if exists "salon front desk can manage orders" on public.frizi_salon_orders;
create policy "salon front desk can manage orders"
on public.frizi_salon_orders
for all
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon members can read order items" on public.frizi_salon_order_items;
create policy "salon members can read order items"
on public.frizi_salon_order_items
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "clients can read own salon order items" on public.frizi_salon_order_items;
create policy "clients can read own salon order items"
on public.frizi_salon_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.frizi_salon_orders salon_order
    join public.frizi_clients client on client.id = salon_order.client_id
    where salon_order.id = frizi_salon_order_items.order_id
      and client.profile_id = public.frizi_current_profile_id()
  )
);

drop policy if exists "salon front desk can manage order items" on public.frizi_salon_order_items;
create policy "salon front desk can manage order items"
on public.frizi_salon_order_items
for all
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon members can read tip allocations" on public.frizi_salon_tip_allocations;
create policy "salon members can read tip allocations"
on public.frizi_salon_tip_allocations
for select
to authenticated
using (
  public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
  or public.frizi_is_current_salon_staff_assignment(staff_assignment_id)
);

drop policy if exists "salon front desk can manage tip allocations" on public.frizi_salon_tip_allocations;
create policy "salon front desk can manage tip allocations"
on public.frizi_salon_tip_allocations
for all
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon members can read refunds" on public.frizi_salon_refunds;
create policy "salon members can read refunds"
on public.frizi_salon_refunds
for select
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon managers can manage refunds" on public.frizi_salon_refunds;
create policy "salon managers can manage refunds"
on public.frizi_salon_refunds
for all
to authenticated
using (public.frizi_can_manage_salon(salon_id))
with check (public.frizi_can_manage_salon(salon_id));

drop policy if exists "salon managers can read payment events" on public.frizi_salon_payment_events;
create policy "salon managers can read payment events"
on public.frizi_salon_payment_events
for select
to authenticated
using (salon_id is not null and public.frizi_can_manage_salon(salon_id));

grant select, insert, update on public.frizi_salon_tax_rules to authenticated;
grant select, insert, update on public.frizi_salon_orders to authenticated;
grant select, insert, update on public.frizi_salon_order_items to authenticated;
grant select, insert, update on public.frizi_salon_tip_allocations to authenticated;
grant select, insert, update on public.frizi_salon_refunds to authenticated;
grant select on public.frizi_salon_payment_events to authenticated;

comment on table public.frizi_salon_orders is
  'Salon-owned POS and checkout ledger. Service revenue, product revenue, tax, tips, credits, refunds, and Stripe references are separated for receipts and reconciliation.';
comment on column public.frizi_salon_orders.merchant_context is
  'Always salon for Salon POS. Independent Frizi Pro payments use the professional merchant context outside this table.';
comment on table public.frizi_salon_tip_allocations is
  'Tip attribution belongs to the service staff member even when the salon merchant receives the Stripe payment.';
comment on table public.frizi_salon_tax_rules is
  'Salon-configured tax rules. Frizi does not hardcode Ontario tax globally.';
comment on table public.frizi_salon_payment_events is
  'Salon Stripe webhook idempotency and processing audit metadata. Sensitive full payloads should remain in server logs or Stripe.';
