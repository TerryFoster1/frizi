-- Replace nested RLS subqueries on frizi_professionals with narrow, RLS-safe
-- boolean helpers. The previous service/location policies could force Postgres
-- to expand frizi_professionals policies while evaluating dependent-table RLS,
-- which caused stack-depth errors and statement timeouts in production.

create or replace function public.frizi_is_current_professional(target_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.frizi_professionals pro
    join public.frizi_profiles profile on profile.id = pro.profile_id
    where pro.id = target_professional_id
      and profile.auth_user_id = (select auth.uid())
      and profile.status = 'active'
      and profile.account_type = 'professional'
  );
$$;

create or replace function public.frizi_is_current_professional(target_professional_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if target_professional_id is null
     or target_professional_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.frizi_is_current_professional(target_professional_id::uuid);
end;
$$;

create or replace function public.frizi_professional_is_publicly_bookable(target_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.frizi_professionals pro
    where pro.id = target_professional_id
      and pro.public_profile_status = 'published'
      and pro.bookable = true
      and pro.subscription_status in ('active', 'trialing')
      and public.frizi_professional_has_active_account(pro.id)
  );
$$;

create or replace function public.frizi_professional_is_publicly_bookable(target_professional_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if target_professional_id is null
     or target_professional_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.frizi_professional_is_publicly_bookable(target_professional_id::uuid);
end;
$$;

revoke all on function public.frizi_is_current_professional(uuid) from public;
revoke all on function public.frizi_is_current_professional(text) from public;
revoke all on function public.frizi_professional_is_publicly_bookable(uuid) from public;
revoke all on function public.frizi_professional_is_publicly_bookable(text) from public;

grant execute on function public.frizi_is_current_professional(uuid) to authenticated;
grant execute on function public.frizi_is_current_professional(text) to authenticated;
grant execute on function public.frizi_professional_is_publicly_bookable(uuid) to anon, authenticated;
grant execute on function public.frizi_professional_is_publicly_bookable(text) to anon, authenticated;

drop policy if exists "professionals can read own inactive services" on public.frizi_services;
create policy "professionals can read own inactive services"
on public.frizi_services
for select
to authenticated
using (public.frizi_is_current_professional(professional_id));

drop policy if exists "professionals can create own services" on public.frizi_services;
create policy "professionals can create own services"
on public.frizi_services
for insert
to authenticated
with check (public.frizi_is_current_professional(professional_id));

drop policy if exists "professionals can update own services" on public.frizi_services;
create policy "professionals can update own services"
on public.frizi_services
for update
to authenticated
using (public.frizi_is_current_professional(professional_id))
with check (public.frizi_is_current_professional(professional_id));

drop policy if exists "active public services are readable" on public.frizi_services;
create policy "active public services are readable"
on public.frizi_services
for select
to anon, authenticated
using (
  active = true
  and online_booking_enabled = true
  and public.frizi_professional_is_publicly_bookable(professional_id)
);

drop policy if exists "professionals can manage own locations" on public.frizi_professional_locations;
create policy "professionals can manage own locations"
on public.frizi_professional_locations
for all
to authenticated
using (public.frizi_is_current_professional(professional_id))
with check (public.frizi_is_current_professional(professional_id));

drop policy if exists "public can read active professional locations" on public.frizi_professional_locations;
create policy "public can read active professional locations"
on public.frizi_professional_locations
for select
to anon, authenticated
using (
  active = true
  and public.frizi_professional_is_publicly_bookable(professional_id)
);

drop policy if exists "professionals can manage own service addons" on public.frizi_service_addons;
create policy "professionals can manage own service addons"
on public.frizi_service_addons
for all
to authenticated
using (public.frizi_is_current_professional(professional_id))
with check (public.frizi_is_current_professional(professional_id));

drop policy if exists "public can read active service addons" on public.frizi_service_addons;
create policy "public can read active service addons"
on public.frizi_service_addons
for select
to anon, authenticated
using (
  active = true
  and public.frizi_professional_is_publicly_bookable(professional_id)
);

comment on function public.frizi_is_current_professional(uuid) is
  'RLS-safe ownership check for professional-owned tables. Returns only whether auth.uid() owns the professional.';

comment on function public.frizi_professional_is_publicly_bookable(uuid) is
  'RLS-safe public eligibility check for client discovery and public professional-owned records.';
