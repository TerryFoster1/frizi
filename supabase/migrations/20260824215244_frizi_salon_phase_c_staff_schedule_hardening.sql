-- Frizi Salon Phase C: staff calendar resources and schedule guardrails.
-- This extends the existing Salon staff/schedule model without creating auth users
-- for Free calendar staff and without duplicating canonical appointments.

alter table public.frizi_salon_staff_assignments
  add column if not exists photo_url text,
  add column if not exists calendar_color text,
  add column if not exists connection_status text not null default 'calendar_only'
    check (connection_status in ('calendar_only', 'invited', 'connected', 'frizi_pro', 'inactive')),
  add column if not exists manual_working_hours jsonb not null default '{}'::jsonb;

update public.frizi_salon_staff_assignments
set connection_status = case
    when professional_id is not null and pro_upgrade_status = 'active' then 'frizi_pro'
    when professional_id is not null then 'connected'
    when employment_status in ('inactive', 'leave', 'archived') then 'inactive'
    else 'calendar_only'
  end,
  manual_working_hours = case
    when manual_working_hours = '{}'::jsonb and jsonb_typeof(settings->'workingHours') = 'object'
      then settings->'workingHours'
    else manual_working_hours
  end
where true;

create index if not exists frizi_salon_staff_assignments_connection_idx
  on public.frizi_salon_staff_assignments (salon_id, connection_status, employment_status);

create or replace function public.frizi_validate_salon_shift()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment record;
begin
  if new.ends_at <= new.starts_at then
    raise exception 'Shift end time must be after start time.'
      using errcode = '22007';
  end if;

  select id, salon_id, location_id, employment_status
  into assignment
  from public.frizi_salon_staff_assignments
  where id = new.staff_assignment_id;

  if assignment.id is null then
    raise exception 'Choose a valid team member for this shift.'
      using errcode = '23514';
  end if;

  if assignment.employment_status <> 'active' then
    raise exception 'This team member is not active for scheduling.'
      using errcode = '23514';
  end if;

  if assignment.salon_id <> new.salon_id then
    raise exception 'The shift salon does not match the team member.'
      using errcode = '23514';
  end if;

  if new.location_id is null then
    new.location_id := assignment.location_id;
  end if;

  if exists (
    select 1
    from public.frizi_salon_shifts existing
    where existing.staff_assignment_id = new.staff_assignment_id
      and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and existing.status not in ('cancelled', 'archived')
      and new.status not in ('cancelled', 'archived')
      and tstzrange(existing.starts_at, existing.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'This shift overlaps another shift for this team member.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.frizi_salon_time_off_requests time_off
    where time_off.staff_assignment_id = new.staff_assignment_id
      and time_off.status = 'approved'
      and new.status not in ('cancelled', 'archived')
      and tstzrange(time_off.starts_at, time_off.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'This team member is unavailable during that time.'
      using errcode = '23514';
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.frizi_validate_salon_shift() from public;

drop trigger if exists frizi_validate_salon_shift_trigger on public.frizi_salon_shifts;
create trigger frizi_validate_salon_shift_trigger
before insert or update on public.frizi_salon_shifts
for each row
execute function public.frizi_validate_salon_shift();

create or replace function public.frizi_prevent_appointment_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  effective_end timestamptz;
begin
  if new.status not in ('pending', 'confirmed', 'requested', 'arrived', 'in_service') then
    return new;
  end if;

  effective_end := coalesce(new.ends_at, new.starts_at + interval '30 minutes');

  if exists (
    select 1
    from public.frizi_appointments existing
    where existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and existing.status in ('pending', 'confirmed', 'requested', 'arrived', 'in_service')
      and coalesce(existing.ends_at, existing.starts_at + interval '30 minutes') > new.starts_at
      and existing.starts_at < effective_end
      and (
        (new.professional_id is not null and existing.professional_id = new.professional_id)
        or (
          new.salon_staff_assignment_id is not null
          and existing.salon_staff_assignment_id = new.salon_staff_assignment_id
        )
      )
  ) then
    raise exception 'This professional already has an appointment at that time.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.frizi_prevent_appointment_overlap() from public;

drop trigger if exists frizi_prevent_appointment_overlap_trigger on public.frizi_appointments;
create trigger frizi_prevent_appointment_overlap_trigger
before insert or update on public.frizi_appointments
for each row
execute function public.frizi_prevent_appointment_overlap();

drop policy if exists "owners and managers can create time off" on public.frizi_salon_time_off_requests;
create policy "owners and managers can create time off"
on public.frizi_salon_time_off_requests
for insert
to authenticated
with check (public.frizi_can_manage_salon(salon_id));

drop policy if exists "owners and managers can manage staff availability" on public.frizi_salon_staff_availability;
create policy "owners and managers can manage staff availability"
on public.frizi_salon_staff_availability
for all
to authenticated
using (public.frizi_can_manage_salon(salon_id))
with check (public.frizi_can_manage_salon(salon_id));

comment on column public.frizi_salon_staff_assignments.connection_status is
  'Calendar-only, invited, connected, Frizi Pro, or inactive. Free calendar staff do not require auth users.';

comment on column public.frizi_salon_staff_assignments.manual_working_hours is
  'Manager-entered normal working hours for calendar staff. Availability remains separate from published shifts.';

comment on function public.frizi_validate_salon_shift() is
  'Validates Salon shifts against staff ownership, active state, same staff overlaps, multi-location overlap, and approved time off.';

comment on function public.frizi_prevent_appointment_overlap() is
  'Prevents overlapping active Frizi appointments for the same professional or linked Salon staff assignment.';
