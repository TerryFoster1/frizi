-- Frizi Salon Admin PIN and short-lived admin elevation.
--
-- Admin PIN is a second factor for management surfaces only.
-- It never replaces the authenticated Supabase session.

create extension if not exists pgcrypto;

create table if not exists public.frizi_salon_admin_pin_credentials (
  salon_id uuid primary key references public.frizi_salons(id) on delete cascade,
  pin_hash text not null,
  created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  updated_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  changed_at timestamptz not null default now()
);

create table if not exists public.frizi_salon_admin_pin_attempts (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  profile_id uuid references public.frizi_profiles(id) on delete set null,
  attempted_at timestamptz not null default now(),
  success boolean not null default false,
  lockout_until timestamptz
);

create index if not exists frizi_salon_admin_pin_attempts_salon_profile_idx
  on public.frizi_salon_admin_pin_attempts (salon_id, profile_id, attempted_at desc);

create table if not exists public.frizi_salon_admin_elevations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  profile_id uuid not null references public.frizi_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists frizi_salon_admin_elevations_lookup_idx
  on public.frizi_salon_admin_elevations (id, salon_id, profile_id, expires_at)
  where revoked_at is null;

alter table public.frizi_salon_admin_pin_credentials enable row level security;
alter table public.frizi_salon_admin_pin_attempts enable row level security;
alter table public.frizi_salon_admin_elevations enable row level security;

revoke all on public.frizi_salon_admin_pin_credentials from anon, authenticated;
revoke all on public.frizi_salon_admin_pin_attempts from anon, authenticated;
revoke all on public.frizi_salon_admin_elevations from anon, authenticated;

create or replace function public.frizi_current_salon_owner_profile_id(target_salon_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select profile.id
  from public.frizi_profiles profile
  join public.frizi_salon_memberships membership
    on membership.profile_id = profile.id
   and membership.salon_id = target_salon_id
   and membership.role = 'owner'
   and membership.status = 'active'
  where profile.auth_user_id = (select auth.uid())
    and profile.account_type = 'salon_owner'
    and profile.status = 'active'
  limit 1;
$$;

create or replace function public.frizi_salon_admin_pin_status(target_salon_id uuid)
returns table(has_pin boolean, locked_until timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_profile_id uuid;
begin
  owner_profile_id := public.frizi_current_salon_owner_profile_id(target_salon_id);
  if owner_profile_id is null then
    raise exception 'Only the authenticated Salon owner can manage Admin access.';
  end if;

  return query
  select
    exists (
      select 1
      from public.frizi_salon_admin_pin_credentials credential
      where credential.salon_id = target_salon_id
    ) as has_pin,
    (
      select max(attempt.lockout_until)
      from public.frizi_salon_admin_pin_attempts attempt
      where attempt.salon_id = target_salon_id
        and attempt.profile_id = owner_profile_id
        and attempt.lockout_until > now()
    ) as locked_until;
end;
$$;

create or replace function public.frizi_set_salon_admin_pin(target_salon_id uuid, pin text)
returns table(has_pin boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_profile_id uuid;
begin
  owner_profile_id := public.frizi_current_salon_owner_profile_id(target_salon_id);
  if owner_profile_id is null then
    raise exception 'Only the authenticated Salon owner can set the Admin PIN.';
  end if;

  if pin is null or pin !~ '^[0-9]{4}$' then
    raise exception 'Admin PIN must be exactly 4 digits.';
  end if;

  insert into public.frizi_salon_admin_pin_credentials (
    salon_id,
    pin_hash,
    created_by_profile_id,
    updated_by_profile_id
  )
  values (
    target_salon_id,
    crypt(pin, gen_salt('bf')),
    owner_profile_id,
    owner_profile_id
  )
  on conflict (salon_id) do update
    set pin_hash = excluded.pin_hash,
        updated_by_profile_id = owner_profile_id,
        updated_at = now(),
        changed_at = now();

  update public.frizi_salon_admin_elevations
  set revoked_at = now()
  where salon_id = target_salon_id
    and revoked_at is null;

  return query select true;
end;
$$;

create or replace function public.frizi_verify_salon_admin_pin(target_salon_id uuid, pin text)
returns table(elevation_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_profile_id uuid;
  credential_hash text;
  failed_count integer;
  lock_until timestamptz;
  new_elevation_id uuid;
  new_expires_at timestamptz;
begin
  owner_profile_id := public.frizi_current_salon_owner_profile_id(target_salon_id);
  if owner_profile_id is null then
    raise exception 'Only the authenticated Salon owner can unlock Admin.';
  end if;

  select max(attempt.lockout_until)
  into lock_until
  from public.frizi_salon_admin_pin_attempts attempt
  where attempt.salon_id = target_salon_id
    and attempt.profile_id = owner_profile_id
    and attempt.lockout_until > now();

  if lock_until is not null then
    raise exception 'Admin is temporarily locked. Please wait before trying again.';
  end if;

  select credential.pin_hash
  into credential_hash
  from public.frizi_salon_admin_pin_credentials credential
  where credential.salon_id = target_salon_id;

  if credential_hash is null then
    raise exception 'Create an Admin PIN before opening Admin.';
  end if;

  if pin is null or pin !~ '^[0-9]{4}$' or credential_hash <> crypt(pin, credential_hash) then
    select count(*)
    into failed_count
    from public.frizi_salon_admin_pin_attempts attempt
    where attempt.salon_id = target_salon_id
      and attempt.profile_id = owner_profile_id
      and attempt.success = false
      and attempt.attempted_at > now() - interval '15 minutes';

    lock_until := case
      when failed_count + 1 >= 7 then now() + interval '15 minutes'
      when failed_count + 1 >= 5 then now() + interval '5 minutes'
      else null
    end;

    insert into public.frizi_salon_admin_pin_attempts (salon_id, profile_id, success, lockout_until)
    values (target_salon_id, owner_profile_id, false, lock_until);

    if lock_until is not null then
      raise exception 'Too many incorrect PIN attempts. Admin is temporarily locked.';
    end if;

    raise exception 'Incorrect Admin PIN.';
  end if;

  insert into public.frizi_salon_admin_pin_attempts (salon_id, profile_id, success)
  values (target_salon_id, owner_profile_id, true);

  new_expires_at := now() + interval '15 minutes';

  insert into public.frizi_salon_admin_elevations (salon_id, profile_id, expires_at)
  values (target_salon_id, owner_profile_id, new_expires_at)
  returning id into new_elevation_id;

  return query select new_elevation_id, new_expires_at;
end;
$$;

create or replace function public.frizi_lock_salon_admin(target_salon_id uuid, target_elevation_id uuid)
returns table(locked boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_profile_id uuid;
begin
  owner_profile_id := public.frizi_current_salon_owner_profile_id(target_salon_id);
  if owner_profile_id is null then
    raise exception 'Only the authenticated Salon owner can lock Admin.';
  end if;

  update public.frizi_salon_admin_elevations
  set revoked_at = now()
  where id = target_elevation_id
    and salon_id = target_salon_id
    and profile_id = owner_profile_id
    and revoked_at is null;

  return query select true;
end;
$$;

create or replace function public.frizi_touch_salon_admin_elevation(target_salon_id uuid, target_elevation_id uuid)
returns table(valid boolean, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_profile_id uuid;
  current_expiry timestamptz;
  new_expiry timestamptz;
begin
  owner_profile_id := public.frizi_current_salon_owner_profile_id(target_salon_id);
  if owner_profile_id is null then
    return query select false, null::timestamptz;
    return;
  end if;

  select elevation.expires_at
  into current_expiry
  from public.frizi_salon_admin_elevations elevation
  where elevation.id = target_elevation_id
    and elevation.salon_id = target_salon_id
    and elevation.profile_id = owner_profile_id
    and elevation.revoked_at is null
    and elevation.expires_at > now();

  if current_expiry is null then
    return query select false, null::timestamptz;
    return;
  end if;

  new_expiry := now() + interval '15 minutes';

  update public.frizi_salon_admin_elevations
  set last_used_at = now(),
      expires_at = new_expiry
  where id = target_elevation_id;

  return query select true, new_expiry;
end;
$$;

grant execute on function public.frizi_current_salon_owner_profile_id(uuid) to authenticated;
grant execute on function public.frizi_salon_admin_pin_status(uuid) to authenticated;
grant execute on function public.frizi_set_salon_admin_pin(uuid, text) to authenticated;
grant execute on function public.frizi_verify_salon_admin_pin(uuid, text) to authenticated;
grant execute on function public.frizi_lock_salon_admin(uuid, uuid) to authenticated;
grant execute on function public.frizi_touch_salon_admin_elevation(uuid, uuid) to authenticated;

comment on table public.frizi_salon_admin_pin_credentials is
  'Stores hashed four-digit Salon Admin PIN credentials. PIN plaintext is never stored or returned.';

comment on table public.frizi_salon_admin_elevations is
  'Short-lived Salon-specific Admin elevation sessions created after successful PIN verification.';
