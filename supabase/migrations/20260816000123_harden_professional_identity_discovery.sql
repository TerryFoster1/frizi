-- Fail closed if a Supabase Auth user is manually deleted outside the Frizi
-- account-deletion flow. Public discovery must never rely only on cached
-- subscription/bookable flags.

update public.frizi_professionals pro
set
  public_profile_status = 'draft',
  bookable = false,
  subscription_status = case
    when pro.subscription_status in ('active', 'trialing') then 'no_subscription'
    else pro.subscription_status
  end,
  updated_at = now()
where not exists (
  select 1
  from public.frizi_profiles profile
  join auth.users auth_user on auth_user.id = profile.auth_user_id
  where profile.id = pro.profile_id
    and profile.status = 'active'
    and profile.account_type = 'professional'
);

update public.frizi_profiles profile
set
  auth_user_id = null,
  status = case when status = 'active' then 'deleted' else status end,
  updated_at = now()
where auth_user_id is not null
  and not exists (
    select 1
    from auth.users auth_user
    where auth_user.id = profile.auth_user_id
  );

alter table public.frizi_profiles
  drop constraint if exists frizi_profiles_auth_user_id_fkey;

alter table public.frizi_profiles
  add constraint frizi_profiles_auth_user_id_fkey
  foreign key (auth_user_id)
  references auth.users(id)
  on delete set null;

create or replace function public.frizi_professional_has_active_account(target_professional_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.frizi_professionals pro
    join public.frizi_profiles profile on profile.id = pro.profile_id
    where pro.id = target_professional_id
      and profile.status = 'active'
      and profile.account_type = 'professional'
      and profile.auth_user_id is not null
  );
$$;

create or replace function public.frizi_deactivate_professional_when_auth_removed()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.auth_user_id is not null and new.auth_user_id is null then
    update public.frizi_professionals
    set
      public_profile_status = 'draft',
      bookable = false,
      subscription_status = case
        when subscription_status in ('active', 'trialing') then 'no_subscription'
        else subscription_status
      end,
      updated_at = now()
    where profile_id = new.id;

    update public.frizi_professional_invites
    set
      status = 'revoked',
      updated_at = now()
    where professional_id in (
      select id from public.frizi_professionals where profile_id = new.id
    )
      and status = 'active';
  end if;

  return new;
end;
$$;

drop trigger if exists frizi_profile_auth_removed_deactivates_professional on public.frizi_profiles;

create trigger frizi_profile_auth_removed_deactivates_professional
after update of auth_user_id on public.frizi_profiles
for each row
execute function public.frizi_deactivate_professional_when_auth_removed();

drop policy if exists "published professional profiles are public readable" on public.frizi_professionals;
create policy "published professional profiles are public readable"
on public.frizi_professionals
for select
to anon, authenticated
using (
  public_profile_status = 'published'
  and bookable = true
  and subscription_status in ('active', 'trialing')
  and public.frizi_professional_has_active_account(id)
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
      and public.frizi_professional_has_active_account(pro.id)
  )
);

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
      and pro.subscription_status in ('active', 'trialing')
      and public.frizi_professional_has_active_account(pro.id)
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
      and pro.subscription_status in ('active', 'trialing')
      and public.frizi_professional_has_active_account(pro.id)
  )
);

comment on function public.frizi_professional_has_active_account(uuid) is
  'Returns true only when a professional is backed by an active Frizi profile with a non-null Supabase Auth identity. The auth_user_id FK is ON DELETE SET NULL so manual Auth deletion fails public discovery closed.';

comment on trigger frizi_profile_auth_removed_deactivates_professional on public.frizi_profiles is
  'Drafts/de-books professionals and revokes active invites when the linked Auth identity is removed.';
