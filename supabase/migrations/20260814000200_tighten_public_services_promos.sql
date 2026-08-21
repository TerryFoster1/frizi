-- Tighten public discovery surfaces so services and promos only appear for
-- professionals who are published, bookable, and actively subscribed/trialing.

drop policy if exists "active public services are readable" on public.frizi_services;

create policy "active public services are readable"
on public.frizi_services
for select
to anon, authenticated
using (
  active = true
  and online_booking_enabled = true
  and exists (
    select 1
    from public.frizi_professionals pro
    where pro.id::text = frizi_services.professional_id
      and pro.public_profile_status = 'published'
      and pro.bookable = true
      and pro.subscription_status = any (array['active'::text, 'trialing'::text])
  )
);

drop policy if exists "active public appointment promotions are readable" on public.frizi_promotions;

create policy "active public appointment promotions are readable"
on public.frizi_promotions
for select
to anon, authenticated
using (
  active = true
  and (start_at is null or start_at <= now())
  and (end_at is null or end_at >= now())
  and exists (
    select 1
    from public.frizi_professionals pro
    where pro.id::text = frizi_promotions.created_by
      and pro.public_profile_status = 'published'
      and pro.bookable = true
      and pro.subscription_status = any (array['active'::text, 'trialing'::text])
  )
);
