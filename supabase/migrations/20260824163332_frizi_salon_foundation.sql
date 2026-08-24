-- Frizi Salon foundation.
-- Adds salon organization, location, membership, and staff assignment records
-- while preserving the existing shared client/pro/appointment/service model.

create table if not exists public.frizi_salons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  public_slug text unique,
  status text not null default 'active'
    check (status in ('draft', 'active', 'suspended', 'archived')),
  primary_owner_profile_id uuid references public.frizi_profiles(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_salon_locations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  name text not null,
  address_line_1 text,
  address_line_2 text,
  city text,
  province text,
  postal_code text,
  country text not null default 'CA',
  phone text,
  timezone text not null default 'America/Toronto',
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  primary_location boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_salon_memberships (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  profile_id uuid references public.frizi_profiles(id) on delete cascade,
  invited_email text,
  role text not null
    check (role in ('owner', 'manager', 'reception', 'staff')),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'removed')),
  invited_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_salon_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  location_id uuid references public.frizi_salon_locations(id) on delete set null,
  membership_id uuid references public.frizi_salon_memberships(id) on delete set null,
  staff_profile_id uuid references public.frizi_profiles(id) on delete set null,
  professional_id uuid references public.frizi_professionals(id) on delete set null,
  display_name text,
  professional_title text,
  chair_label text,
  employment_status text not null default 'active'
    check (employment_status in ('active', 'inactive', 'leave', 'archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists frizi_salons_owner_idx
  on public.frizi_salons (primary_owner_profile_id);

create index if not exists frizi_salon_locations_salon_status_idx
  on public.frizi_salon_locations (salon_id, status);

create unique index if not exists frizi_salon_locations_one_primary_idx
  on public.frizi_salon_locations (salon_id)
  where primary_location = true and status = 'active';

create index if not exists frizi_salon_memberships_salon_role_idx
  on public.frizi_salon_memberships (salon_id, role, status);

create unique index if not exists frizi_salon_memberships_one_profile_per_salon_idx
  on public.frizi_salon_memberships (salon_id, profile_id)
  where profile_id is not null;

create unique index if not exists frizi_salon_memberships_one_invite_email_per_salon_idx
  on public.frizi_salon_memberships (salon_id, lower(invited_email))
  where profile_id is null and invited_email is not null and status in ('invited', 'active');

create index if not exists frizi_salon_staff_assignments_salon_location_idx
  on public.frizi_salon_staff_assignments (salon_id, location_id, employment_status);

create unique index if not exists frizi_salon_staff_assignments_professional_idx
  on public.frizi_salon_staff_assignments (salon_id, professional_id)
  where professional_id is not null and employment_status <> 'archived';

alter table public.frizi_salons enable row level security;
alter table public.frizi_salon_locations enable row level security;
alter table public.frizi_salon_memberships enable row level security;
alter table public.frizi_salon_staff_assignments enable row level security;

create or replace function public.frizi_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select profile.id
  from public.frizi_profiles profile
  where profile.auth_user_id = (select auth.uid())
    and profile.status = 'active'
  limit 1;
$$;

create or replace function public.frizi_is_salon_member(
  target_salon_id uuid,
  allowed_roles text[] default array['owner', 'manager', 'reception', 'staff']
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.frizi_salon_memberships membership
    where membership.salon_id = target_salon_id
      and membership.profile_id = public.frizi_current_profile_id()
      and membership.status = 'active'
      and membership.role = any(allowed_roles)
  );
$$;

create or replace function public.frizi_can_manage_salon(target_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.frizi_is_salon_member(target_salon_id, array['owner', 'manager']);
$$;

create or replace function public.frizi_is_salon_primary_owner(target_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.frizi_salons salon
    where salon.id = target_salon_id
      and salon.primary_owner_profile_id = public.frizi_current_profile_id()
  );
$$;

revoke all on function public.frizi_current_profile_id() from public;
revoke all on function public.frizi_is_salon_member(uuid, text[]) from public;
revoke all on function public.frizi_can_manage_salon(uuid) from public;
revoke all on function public.frizi_is_salon_primary_owner(uuid) from public;

grant execute on function public.frizi_current_profile_id() to authenticated;
grant execute on function public.frizi_is_salon_member(uuid, text[]) to authenticated;
grant execute on function public.frizi_can_manage_salon(uuid) to authenticated;
grant execute on function public.frizi_is_salon_primary_owner(uuid) to authenticated;

drop policy if exists "salon members can read salons" on public.frizi_salons;
create policy "salon members can read salons"
on public.frizi_salons
for select
to authenticated
using (public.frizi_is_salon_member(id));

drop policy if exists "owners can create their salon" on public.frizi_salons;
create policy "owners can create their salon"
on public.frizi_salons
for insert
to authenticated
with check (primary_owner_profile_id = public.frizi_current_profile_id());

drop policy if exists "owners and managers can update salons" on public.frizi_salons;
create policy "owners and managers can update salons"
on public.frizi_salons
for update
to authenticated
using (public.frizi_can_manage_salon(id))
with check (public.frizi_can_manage_salon(id));

drop policy if exists "salon members can read locations" on public.frizi_salon_locations;
create policy "salon members can read locations"
on public.frizi_salon_locations
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "owners and managers can manage locations" on public.frizi_salon_locations;
create policy "owners and managers can manage locations"
on public.frizi_salon_locations
for all
to authenticated
using (public.frizi_can_manage_salon(salon_id))
with check (public.frizi_can_manage_salon(salon_id));

drop policy if exists "members can read their salon memberships" on public.frizi_salon_memberships;
create policy "members can read their salon memberships"
on public.frizi_salon_memberships
for select
to authenticated
using (
  profile_id = public.frizi_current_profile_id()
  or public.frizi_can_manage_salon(salon_id)
);

drop policy if exists "owners can create their initial membership" on public.frizi_salon_memberships;
create policy "owners can create their initial membership"
on public.frizi_salon_memberships
for insert
to authenticated
with check (
  profile_id = public.frizi_current_profile_id()
  and role = 'owner'
  and public.frizi_is_salon_primary_owner(salon_id)
);

drop policy if exists "owners and managers can manage memberships" on public.frizi_salon_memberships;
create policy "owners and managers can manage memberships"
on public.frizi_salon_memberships
for all
to authenticated
using (public.frizi_can_manage_salon(salon_id))
with check (public.frizi_can_manage_salon(salon_id));

drop policy if exists "salon members can read staff assignments" on public.frizi_salon_staff_assignments;
create policy "salon members can read staff assignments"
on public.frizi_salon_staff_assignments
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "owners and managers can manage staff assignments" on public.frizi_salon_staff_assignments;
create policy "owners and managers can manage staff assignments"
on public.frizi_salon_staff_assignments
for all
to authenticated
using (public.frizi_can_manage_salon(salon_id))
with check (public.frizi_can_manage_salon(salon_id));

comment on table public.frizi_salons is
  'Salon organization record for multi-location Frizi Salon accounts. Shared appointments, clients, professionals, services, promos, messages, products, and reviews remain canonical in their existing Frizi tables.';

comment on table public.frizi_salon_locations is
  'Physical or operational locations owned by a salon organization.';

comment on table public.frizi_salon_memberships is
  'Role-scoped user membership in a salon organization. Initial roles are owner, manager, reception, and staff.';

comment on table public.frizi_salon_staff_assignments is
  'Salon roster/chair assignment that may link to an existing independent professional profile without making that staff member a paid Frizi Pro subscriber.';

comment on function public.frizi_current_profile_id() is
  'Returns the active Frizi profile for the authenticated Supabase Auth user.';

comment on function public.frizi_is_salon_member(uuid, text[]) is
  'RLS helper for salon-scoped tables. Returns true when the current profile has an active membership with one of the allowed roles.';

comment on function public.frizi_can_manage_salon(uuid) is
  'RLS helper for owner/manager salon administration.';

comment on function public.frizi_is_salon_primary_owner(uuid) is
  'RLS helper that permits only the creator recorded on a salon row to bootstrap the initial owner membership.';
