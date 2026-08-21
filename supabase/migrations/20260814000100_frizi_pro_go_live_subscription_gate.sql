alter table public.frizi_professionals
  add column if not exists profile_photo_url text,
  add column if not exists hero_photo_url text,
  add column if not exists portfolio_photo_urls text[] not null default '{}',
  add column if not exists subscription_plan text
    check (subscription_plan is null or subscription_plan in ('monthly', 'annual'));

alter table public.frizi_professional_subscriptions
  add column if not exists plan_interval text
    check (plan_interval is null or plan_interval in ('monthly', 'annual'));

alter table public.frizi_professionals
  drop constraint if exists frizi_professionals_subscription_status_check;

alter table public.frizi_professionals
  add constraint frizi_professionals_subscription_status_check
  check (
    subscription_status = any (
      array[
        'unknown',
        'no_subscription',
        'checkout_started',
        'active',
        'trialing',
        'past_due',
        'cancelled',
        'incomplete',
        'unpaid'
      ]::text[]
    )
  );

alter table public.frizi_professional_subscriptions
  drop constraint if exists frizi_professional_subscriptions_status_check;

alter table public.frizi_professional_subscriptions
  add constraint frizi_professional_subscriptions_status_check
  check (
    status = any (
      array[
        'checkout_started',
        'active',
        'trialing',
        'past_due',
        'cancelled',
        'incomplete',
        'unpaid'
      ]::text[]
    )
  );

drop policy if exists "published professional profiles are public readable" on public.frizi_professionals;
create policy "published professional profiles are public readable"
on public.frizi_professionals
for select
to anon, authenticated
using (
  public_profile_status = 'published'
  and bookable = true
  and subscription_status in ('active', 'trialing')
);

drop policy if exists "public can read active professional locations" on public.frizi_professional_locations;
create policy "public can read active professional locations"
on public.frizi_professional_locations
for select
to anon, authenticated
using (
  active = true
  and exists (
    select 1
    from public.frizi_professionals pro
    where pro.id = frizi_professional_locations.professional_id
      and pro.public_profile_status = 'published'
      and pro.bookable = true
      and pro.subscription_status in ('active', 'trialing')
  )
);

comment on column public.frizi_professionals.bookable is
  'True only when profile requirements are complete and a current active/trialing subscription has been confirmed by Stripe webhook.';

comment on column public.frizi_professional_subscriptions.plan_interval is
  'Frizi Pro billing cadence from Stripe price metadata: monthly or annual.';
