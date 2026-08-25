alter table public.frizi_salons
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text not null default 'none',
  add column if not exists subscription_plan text,
  add column if not exists subscription_checked_at timestamptz;

alter table public.frizi_salons
  drop constraint if exists frizi_salons_subscription_plan_check;

alter table public.frizi_salons
  add constraint frizi_salons_subscription_plan_check
  check (subscription_plan is null or subscription_plan in ('salon', 'salon_pro'));

create unique index if not exists frizi_salons_stripe_subscription_unique_idx
  on public.frizi_salons (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table if not exists public.frizi_salon_subscriptions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  owner_profile_id uuid references public.frizi_profiles(id) on delete set null,
  status text not null default 'checkout_started',
  plan text not null check (plan in ('salon', 'salon_pro')),
  billing_interval text not null default 'month' check (billing_interval = 'month'),
  currency text not null default 'cad',
  amount_cents integer not null check (amount_cents in (6900, 14900)),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  stripe_price_id text,
  mode text not null default 'test' check (mode in ('test', 'live')),
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists frizi_salon_subscriptions_stripe_subscription_unique_idx
  on public.frizi_salon_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create unique index if not exists frizi_salon_subscriptions_checkout_unique_idx
  on public.frizi_salon_subscriptions (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists frizi_salon_subscriptions_salon_status_idx
  on public.frizi_salon_subscriptions (salon_id, status, updated_at desc);

alter table public.frizi_salon_subscriptions enable row level security;

drop policy if exists "salon owners can read own subscription records" on public.frizi_salon_subscriptions;
create policy "salon owners can read own subscription records"
on public.frizi_salon_subscriptions
for select
to authenticated
using (public.frizi_can_manage_salon(salon_id));

create or replace function public.frizi_salon_resolved_plan(target_salon_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  resolved_plan text;
begin
  select
    case
      when salon.subscription_status in ('active', 'trialing')
        and salon.subscription_plan in ('salon', 'salon_pro')
        then salon.subscription_plan
      when salon.account_plan in ('salon', 'salon_pro') then salon.account_plan
      else 'salon_free'
    end
  into resolved_plan
  from public.frizi_salons salon
  where salon.id = target_salon_id
    and salon.status in ('active', 'draft');

  return coalesce(resolved_plan, 'salon_free');
end;
$$;

comment on table public.frizi_salon_subscriptions is
  'Canonical Salon Stripe subscription state. Free Salon requires no Stripe subscription; paid Salon tiers are activated from verified Stripe webhook or reconciliation.';

comment on column public.frizi_salons.account_plan is
  'Resolved Salon entitlement plan: salon_free, salon, or salon_pro. Server billing code updates this from verified Stripe subscription state.';
