-- Frizi Salon Phase 2: team directory, staff availability, and published shifts.
-- Scheduling remains salon-scoped but does not duplicate canonical appointments.

alter table public.frizi_salon_staff_assignments
  add column if not exists specialties text[] not null default '{}',
  add column if not exists service_ids text[] not null default '{}',
  add column if not exists pro_upgrade_status text not null default 'not_upgraded'
    check (pro_upgrade_status in ('not_upgraded', 'eligible', 'trialing', 'active', 'cancelled')),
  add column if not exists starts_on date,
  add column if not exists ended_on date;

create table if not exists public.frizi_salon_staff_availability (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  location_id uuid references public.frizi_salon_locations(id) on delete set null,
  staff_assignment_id uuid not null references public.frizi_salon_staff_assignments(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  preference text not null default 'available'
    check (preference in ('available', 'preferred', 'unavailable')),
  note text,
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'declined', 'archived')),
  submitted_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  reviewed_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  reviewed_at timestamptz,
  effective_from date,
  effective_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table if not exists public.frizi_salon_time_off_requests (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  staff_assignment_id uuid not null references public.frizi_salon_staff_assignments(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'declined', 'cancelled')),
  submitted_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  reviewed_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table if not exists public.frizi_salon_shifts (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  location_id uuid references public.frizi_salon_locations(id) on delete set null,
  staff_assignment_id uuid not null references public.frizi_salon_staff_assignments(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'changed', 'cancelled', 'archived')),
  schedule_note text,
  published_at timestamptz,
  published_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create index if not exists frizi_salon_staff_availability_staff_day_idx
  on public.frizi_salon_staff_availability (staff_assignment_id, day_of_week, status);

create index if not exists frizi_salon_time_off_staff_status_idx
  on public.frizi_salon_time_off_requests (staff_assignment_id, status, starts_at);

create index if not exists frizi_salon_shifts_salon_time_idx
  on public.frizi_salon_shifts (salon_id, starts_at, ends_at, status);

create index if not exists frizi_salon_shifts_staff_time_idx
  on public.frizi_salon_shifts (staff_assignment_id, starts_at, ends_at, status);

alter table public.frizi_salon_staff_availability enable row level security;
alter table public.frizi_salon_time_off_requests enable row level security;
alter table public.frizi_salon_shifts enable row level security;

create or replace function public.frizi_current_salon_staff_assignment_id(target_salon_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select assignment.id
  from public.frizi_salon_staff_assignments assignment
  where assignment.salon_id = target_salon_id
    and assignment.staff_profile_id = public.frizi_current_profile_id()
    and assignment.employment_status = 'active'
  limit 1;
$$;

create or replace function public.frizi_is_current_salon_staff_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.frizi_salon_staff_assignments assignment
    where assignment.id = target_assignment_id
      and assignment.staff_profile_id = public.frizi_current_profile_id()
      and assignment.employment_status = 'active'
  );
$$;

create or replace function public.frizi_notify_salon_shift_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient_user uuid;
  source text;
begin
  if tg_op = 'INSERT' and new.status <> 'published' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.status, '') = coalesce(new.status, '') and old.starts_at = new.starts_at and old.ends_at = new.ends_at then
    return new;
  end if;

  select profile.auth_user_id
  into recipient_user
  from public.frizi_salon_staff_assignments assignment
  join public.frizi_profiles profile on profile.id = assignment.staff_profile_id
  where assignment.id = new.staff_assignment_id
    and profile.auth_user_id is not null;

  if recipient_user is null then
    return new;
  end if;

  source := 'salon_shift:' || new.id::text || ':' || new.updated_at::text;

  insert into public.frizi_notifications (
    recipient_user_id,
    recipient_role,
    notification_type,
    title,
    body,
    action_path,
    source_key,
    metadata,
    read_at,
    created_at,
    updated_at
  )
  values (
    recipient_user,
    'professional',
    'schedule_changed',
    'Schedule updated',
    'Your salon schedule has been updated.',
    '/calendar',
    source,
    jsonb_build_object(
      'salon_id', new.salon_id,
      'location_id', new.location_id,
      'shift_id', new.id,
      'starts_at', new.starts_at,
      'ends_at', new.ends_at
    ),
    null,
    now(),
    now()
  )
  on conflict (source_key) do nothing;

  return new;
exception
  when undefined_table or undefined_column then
    return new;
end;
$$;

revoke all on function public.frizi_current_salon_staff_assignment_id(uuid) from public;
revoke all on function public.frizi_is_current_salon_staff_assignment(uuid) from public;
revoke all on function public.frizi_notify_salon_shift_change() from public;

grant execute on function public.frizi_current_salon_staff_assignment_id(uuid) to authenticated;
grant execute on function public.frizi_is_current_salon_staff_assignment(uuid) to authenticated;

drop trigger if exists frizi_salon_shift_notification on public.frizi_salon_shifts;
create trigger frizi_salon_shift_notification
after insert or update on public.frizi_salon_shifts
for each row
execute function public.frizi_notify_salon_shift_change();

drop policy if exists "salon members can read staff availability" on public.frizi_salon_staff_availability;
create policy "salon members can read staff availability"
on public.frizi_salon_staff_availability
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "staff can submit own availability" on public.frizi_salon_staff_availability;
create policy "staff can submit own availability"
on public.frizi_salon_staff_availability
for insert
to authenticated
with check (
  submitted_by_profile_id = public.frizi_current_profile_id()
  and public.frizi_is_current_salon_staff_assignment(staff_assignment_id)
);

drop policy if exists "staff can update own submitted availability" on public.frizi_salon_staff_availability;
create policy "staff can update own submitted availability"
on public.frizi_salon_staff_availability
for update
to authenticated
using (
  public.frizi_is_current_salon_staff_assignment(staff_assignment_id)
  or public.frizi_can_manage_salon(salon_id)
)
with check (
  public.frizi_is_current_salon_staff_assignment(staff_assignment_id)
  or public.frizi_can_manage_salon(salon_id)
);

drop policy if exists "salon members can read time off" on public.frizi_salon_time_off_requests;
create policy "salon members can read time off"
on public.frizi_salon_time_off_requests
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "staff can submit own time off" on public.frizi_salon_time_off_requests;
create policy "staff can submit own time off"
on public.frizi_salon_time_off_requests
for insert
to authenticated
with check (
  submitted_by_profile_id = public.frizi_current_profile_id()
  and public.frizi_is_current_salon_staff_assignment(staff_assignment_id)
);

drop policy if exists "staff and managers can update time off" on public.frizi_salon_time_off_requests;
create policy "staff and managers can update time off"
on public.frizi_salon_time_off_requests
for update
to authenticated
using (
  public.frizi_is_current_salon_staff_assignment(staff_assignment_id)
  or public.frizi_can_manage_salon(salon_id)
)
with check (
  public.frizi_is_current_salon_staff_assignment(staff_assignment_id)
  or public.frizi_can_manage_salon(salon_id)
);

drop policy if exists "salon members can read shifts" on public.frizi_salon_shifts;
create policy "salon members can read shifts"
on public.frizi_salon_shifts
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "owners and managers can manage shifts" on public.frizi_salon_shifts;
create policy "owners and managers can manage shifts"
on public.frizi_salon_shifts
for all
to authenticated
using (public.frizi_can_manage_salon(salon_id))
with check (public.frizi_can_manage_salon(salon_id));

comment on table public.frizi_salon_staff_availability is
  'Staff-submitted weekly availability and preferences. This is separate from the published salon shift schedule.';

comment on table public.frizi_salon_time_off_requests is
  'Staff time-off requests visible to salon management.';

comment on table public.frizi_salon_shifts is
  'Published or draft salon shift schedule. These shifts constrain future Pro/client bookability without replacing canonical appointments.';

comment on function public.frizi_current_salon_staff_assignment_id(uuid) is
  'Returns the current profile active staff assignment for a salon, when one exists.';

comment on function public.frizi_is_current_salon_staff_assignment(uuid) is
  'RLS helper for staff-owned availability and time-off rows.';

comment on trigger frizi_salon_shift_notification on public.frizi_salon_shifts is
  'Creates in-app notifications for real published salon shift changes when the staff member has a linked auth identity.';
