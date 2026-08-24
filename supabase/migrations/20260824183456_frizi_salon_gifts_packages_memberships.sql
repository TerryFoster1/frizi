-- Phase 11: shared gift cards, packages, memberships, and entitlements.
-- These are Frizi value products, not loose labels. Client balances/credits are
-- tracked in entitlements and redemptions so Salon, Pro, and Client can reconcile
-- the same purchase history.

create table if not exists public.frizi_value_products (
  id uuid primary key default gen_random_uuid(),
  product_scope text not null check (product_scope in ('salon', 'professional')),
  product_kind text not null check (product_kind in ('gift_card', 'service_gift', 'package', 'membership')),
  salon_id uuid references public.frizi_salons(id) on delete cascade,
  professional_id uuid references public.frizi_professionals(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  currency text not null default 'cad',
  price_cents integer not null default 0 check (price_cents >= 0),
  face_value_cents integer not null default 0 check (face_value_cents >= 0),
  credit_quantity integer not null default 0 check (credit_quantity >= 0),
  service_ids text[] not null default '{}',
  billing_interval text check (billing_interval is null or billing_interval in ('month', 'year')),
  stripe_price_id text,
  redemption_rules jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (product_scope = 'salon' and salon_id is not null and professional_id is null)
    or (product_scope = 'professional' and professional_id is not null)
  ),
  check (
    (product_kind in ('gift_card', 'service_gift') and face_value_cents > 0)
    or (product_kind = 'package' and credit_quantity > 0)
    or (product_kind = 'membership' and billing_interval is not null)
  )
);

create table if not exists public.frizi_client_entitlements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.frizi_clients(id) on delete cascade,
  product_id uuid not null references public.frizi_value_products(id) on delete restrict,
  salon_id uuid references public.frizi_salons(id) on delete cascade,
  professional_id uuid references public.frizi_professionals(id) on delete cascade,
  entitlement_kind text not null check (entitlement_kind in ('gift_balance', 'service_credit', 'membership_benefit')),
  status text not null default 'active' check (status in ('pending_payment', 'active', 'paused', 'redeemed', 'expired', 'cancelled')),
  currency text not null default 'cad',
  original_value_cents integer not null default 0 check (original_value_cents >= 0),
  remaining_value_cents integer not null default 0 check (remaining_value_cents >= 0),
  credits_total integer not null default 0 check (credits_total >= 0),
  credits_remaining integer not null default 0 check (credits_remaining >= 0),
  stripe_checkout_session_id text unique,
  stripe_subscription_id text,
  purchased_order_id uuid references public.frizi_salon_orders(id) on delete set null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  entitlement_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (remaining_value_cents <= original_value_cents),
  check (credits_remaining <= credits_total)
);

create table if not exists public.frizi_entitlement_redemptions (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.frizi_client_entitlements(id) on delete cascade,
  client_id uuid not null references public.frizi_clients(id) on delete cascade,
  salon_id uuid references public.frizi_salons(id) on delete set null,
  professional_id uuid references public.frizi_professionals(id) on delete set null,
  appointment_id uuid references public.frizi_appointments(id) on delete set null,
  order_id uuid references public.frizi_salon_orders(id) on delete set null,
  redeemed_value_cents integer not null default 0 check (redeemed_value_cents >= 0),
  redeemed_credits integer not null default 0 check (redeemed_credits >= 0),
  redemption_status text not null default 'applied' check (redemption_status in ('applied', 'reversed')),
  created_at timestamptz not null default now(),
  check (redeemed_value_cents > 0 or redeemed_credits > 0)
);

create index if not exists frizi_value_products_salon_status_idx
  on public.frizi_value_products (salon_id, status, product_kind)
  where salon_id is not null;

create index if not exists frizi_value_products_professional_status_idx
  on public.frizi_value_products (professional_id, status, product_kind)
  where professional_id is not null;

create index if not exists frizi_client_entitlements_client_status_idx
  on public.frizi_client_entitlements (client_id, status, created_at desc);

create index if not exists frizi_client_entitlements_salon_status_idx
  on public.frizi_client_entitlements (salon_id, status, created_at desc)
  where salon_id is not null;

create index if not exists frizi_entitlement_redemptions_entitlement_idx
  on public.frizi_entitlement_redemptions (entitlement_id, created_at desc);

alter table public.frizi_value_products enable row level security;
alter table public.frizi_client_entitlements enable row level security;
alter table public.frizi_entitlement_redemptions enable row level security;

drop policy if exists "public can read active value products" on public.frizi_value_products;
create policy "public can read active value products"
on public.frizi_value_products
for select
to anon, authenticated
using (status = 'active');

drop policy if exists "salon members can manage salon value products" on public.frizi_value_products;
create policy "salon members can manage salon value products"
on public.frizi_value_products
for all
to authenticated
using (salon_id is not null and public.frizi_is_salon_member(salon_id, array['owner','manager']))
with check (salon_id is not null and public.frizi_is_salon_member(salon_id, array['owner','manager']));

drop policy if exists "professionals can manage own value products" on public.frizi_value_products;
create policy "professionals can manage own value products"
on public.frizi_value_products
for all
to authenticated
using (professional_id = public.frizi_current_professional_id())
with check (professional_id = public.frizi_current_professional_id());

drop policy if exists "clients can read own entitlements" on public.frizi_client_entitlements;
create policy "clients can read own entitlements"
on public.frizi_client_entitlements
for select
to authenticated
using (client_id = public.frizi_current_client_id());

drop policy if exists "salon members can read salon entitlements" on public.frizi_client_entitlements;
create policy "salon members can read salon entitlements"
on public.frizi_client_entitlements
for select
to authenticated
using (salon_id is not null and public.frizi_is_salon_member(salon_id));

drop policy if exists "clients can read own redemptions" on public.frizi_entitlement_redemptions;
create policy "clients can read own redemptions"
on public.frizi_entitlement_redemptions
for select
to authenticated
using (client_id = public.frizi_current_client_id());

drop policy if exists "salon members can read salon redemptions" on public.frizi_entitlement_redemptions;
create policy "salon members can read salon redemptions"
on public.frizi_entitlement_redemptions
for select
to authenticated
using (salon_id is not null and public.frizi_is_salon_member(salon_id));

create or replace function public.frizi_redeem_client_entitlement(
  target_entitlement_id uuid,
  target_appointment_id uuid,
  redeem_value_cents integer default 0,
  redeem_credits integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  entitlement_row public.frizi_client_entitlements%rowtype;
  appointment_row public.frizi_appointments%rowtype;
  redemption_id uuid;
begin
  if coalesce(redeem_value_cents, 0) < 0 or coalesce(redeem_credits, 0) < 0 then
    raise exception 'Redemption amount must be positive';
  end if;

  if coalesce(redeem_value_cents, 0) = 0 and coalesce(redeem_credits, 0) = 0 then
    raise exception 'Choose a gift balance or package credit to redeem';
  end if;

  select *
  into entitlement_row
  from public.frizi_client_entitlements
  where id = target_entitlement_id
  for update;

  if entitlement_row.id is null or entitlement_row.status <> 'active' then
    raise exception 'This entitlement is not active';
  end if;

  select *
  into appointment_row
  from public.frizi_appointments
  where id = target_appointment_id;

  if appointment_row.id is null then
    raise exception 'Appointment was not found';
  end if;

  if appointment_row.client_id <> entitlement_row.client_id then
    raise exception 'Entitlement does not belong to this appointment client';
  end if;

  if entitlement_row.salon_id is not null and appointment_row.salon_id <> entitlement_row.salon_id then
    raise exception 'Gift or package is not valid for this salon';
  end if;

  if entitlement_row.professional_id is not null and appointment_row.professional_id <> entitlement_row.professional_id then
    raise exception 'Gift or package is not valid for this professional';
  end if;

  if coalesce(redeem_value_cents, 0) > entitlement_row.remaining_value_cents then
    raise exception 'Gift balance is too low';
  end if;

  if coalesce(redeem_credits, 0) > entitlement_row.credits_remaining then
    raise exception 'Package credits are too low';
  end if;

  insert into public.frizi_entitlement_redemptions (
    entitlement_id,
    client_id,
    salon_id,
    professional_id,
    appointment_id,
    redeemed_value_cents,
    redeemed_credits
  )
  values (
    entitlement_row.id,
    entitlement_row.client_id,
    entitlement_row.salon_id,
    entitlement_row.professional_id,
    appointment_row.id,
    redeem_value_cents,
    redeem_credits
  )
  returning id into redemption_id;

  update public.frizi_client_entitlements
  set
    remaining_value_cents = remaining_value_cents - redeem_value_cents,
    credits_remaining = credits_remaining - redeem_credits,
    status = case
      when remaining_value_cents - redeem_value_cents = 0
        and credits_remaining - redeem_credits = 0
      then 'redeemed'
      else status
    end,
    updated_at = now()
  where id = entitlement_row.id;

  return redemption_id;
end;
$$;

revoke all on function public.frizi_redeem_client_entitlement(uuid, uuid, integer, integer) from public;
grant execute on function public.frizi_redeem_client_entitlement(uuid, uuid, integer, integer) to authenticated;

grant select, insert, update on public.frizi_value_products to authenticated;
grant select on public.frizi_value_products to anon;
grant select, insert, update on public.frizi_client_entitlements to authenticated;
grant select, insert, update on public.frizi_entitlement_redemptions to authenticated;

comment on table public.frizi_value_products is
  'Shared Frizi gift card, service gift, package, and membership products created by eligible Pro or Salon accounts.';

comment on table public.frizi_client_entitlements is
  'Numeric client-owned balances, credits, and membership benefits created after payment succeeds. This is the canonical entitlement ledger.';

comment on table public.frizi_entitlement_redemptions is
  'Immutable entitlement redemption ledger for appointments and checkout reconciliation. Refund reversal can be added without rewriting balances.';
