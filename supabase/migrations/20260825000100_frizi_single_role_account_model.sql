-- Frizi single-role account hardening.
--
-- Canonical product rule:
-- one Supabase Auth identity owns one Frizi profile with one primary account type.
-- Product-specific records must match that profile type.

alter table public.frizi_profiles
  drop constraint if exists frizi_profiles_account_type_check;

alter table public.frizi_profiles
  add constraint frizi_profiles_account_type_check
  check (account_type in ('client', 'professional', 'salon_owner'));

create unique index if not exists frizi_user_roles_one_active_role_per_profile_idx
  on public.frizi_user_roles (profile_id)
  where status = 'active';

create or replace function public.frizi_profile_account_type(target_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select profile.account_type
  from public.frizi_profiles profile
  where profile.id = target_profile_id
    and profile.status = 'active'
    and profile.auth_user_id is not null;
$$;

create or replace function public.frizi_enforce_client_profile_type()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.profile_id is not null and public.frizi_profile_account_type(new.profile_id) is distinct from 'client' then
    raise exception 'Frizi client records require a client account.';
  end if;

  return new;
end;
$$;

drop trigger if exists frizi_clients_enforce_profile_type on public.frizi_clients;
create trigger frizi_clients_enforce_profile_type
before insert or update of profile_id on public.frizi_clients
for each row
execute function public.frizi_enforce_client_profile_type();

create or replace function public.frizi_enforce_professional_profile_type()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.profile_id is null or public.frizi_profile_account_type(new.profile_id) is distinct from 'professional' then
    raise exception 'Frizi professional records require a professional account.';
  end if;

  return new;
end;
$$;

drop trigger if exists frizi_professionals_enforce_profile_type on public.frizi_professionals;
create trigger frizi_professionals_enforce_profile_type
before insert or update of profile_id on public.frizi_professionals
for each row
execute function public.frizi_enforce_professional_profile_type();

create or replace function public.frizi_enforce_salon_owner_profile_type()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.primary_owner_profile_id is null
     or public.frizi_profile_account_type(new.primary_owner_profile_id) is distinct from 'salon_owner' then
    raise exception 'Frizi Salon ownership requires a salon owner account.';
  end if;

  return new;
end;
$$;

drop trigger if exists frizi_salons_enforce_owner_profile_type on public.frizi_salons;
create trigger frizi_salons_enforce_owner_profile_type
before insert or update of primary_owner_profile_id on public.frizi_salons
for each row
execute function public.frizi_enforce_salon_owner_profile_type();

create or replace function public.frizi_enforce_salon_membership_profile_type()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.profile_id is not null
     and new.status = 'active'
     and new.role = 'owner'
     and public.frizi_profile_account_type(new.profile_id) is distinct from 'salon_owner' then
    raise exception 'Frizi Salon owner memberships require a salon owner account.';
  end if;

  return new;
end;
$$;

drop trigger if exists frizi_salon_memberships_enforce_profile_type on public.frizi_salon_memberships;
create trigger frizi_salon_memberships_enforce_profile_type
before insert or update of profile_id, role, status on public.frizi_salon_memberships
for each row
execute function public.frizi_enforce_salon_membership_profile_type();

create or replace function public.frizi_enforce_user_role_matches_profile_type()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_type text;
begin
  if new.status <> 'active' then
    return new;
  end if;

  profile_type := public.frizi_profile_account_type(new.profile_id);

  if new.role in ('client', 'professional', 'salon_owner') and profile_type is distinct from new.role then
    raise exception 'Frizi account role must match the profile account type.';
  end if;

  return new;
end;
$$;

drop trigger if exists frizi_user_roles_enforce_single_product_role on public.frizi_user_roles;
create trigger frizi_user_roles_enforce_single_product_role
before insert or update of profile_id, role, status on public.frizi_user_roles
for each row
execute function public.frizi_enforce_user_role_matches_profile_type();

comment on constraint frizi_profiles_account_type_check on public.frizi_profiles is
  'Canonical Frizi primary account type. A single Auth identity may be client, professional, or salon_owner, but not multiple product identities.';

comment on index public.frizi_user_roles_one_active_role_per_profile_idx is
  'Allows at most one active product role per Frizi profile.';

comment on function public.frizi_profile_account_type(uuid) is
  'Returns the active account type for a profile only when it is still backed by a Supabase Auth identity.';
