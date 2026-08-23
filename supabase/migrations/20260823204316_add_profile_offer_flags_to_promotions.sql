alter table public.frizi_promotions
  add column if not exists show_on_profile boolean not null default false,
  add column if not exists is_featured_profile_offer boolean not null default false;

create index if not exists frizi_promotions_profile_offer_idx
  on public.frizi_promotions (created_by, active, show_on_profile, is_featured_profile_offer, updated_at desc)
  where archived_at is null;

drop policy if exists "active public appointment promotions are readable" on public.frizi_promotions;
create policy "active public appointment promotions are readable"
on public.frizi_promotions
for select
to anon, authenticated
using (
  active = true
  and show_on_profile = true
  and is_featured_profile_offer = true
  and (start_at is null or start_at <= now())
  and (end_at is null or end_at >= now())
  and exists (
    select 1
    from public.frizi_professionals pro
    where pro.id::text = frizi_promotions.created_by
      and pro.public_profile_status = 'published'
      and pro.bookable = true
      and pro.subscription_status in ('active', 'trialing')
      and public.frizi_professional_has_active_account(pro.id)
  )
);

comment on column public.frizi_promotions.show_on_profile is
  'Explicit professional opt-in for showing a promotion on the public Frizi profile. Defaults false so private/direct campaigns never become public by inference.';

comment on column public.frizi_promotions.is_featured_profile_offer is
  'MVP profile-offer marker. Client profile reads only one active featured profile offer per professional.';
