-- Phase 3: unify Salon calendar/bookings with the canonical Frizi appointment table.

alter table public.frizi_appointments
  add column if not exists salon_id uuid references public.frizi_salons(id) on delete set null,
  add column if not exists salon_location_id uuid references public.frizi_salon_locations(id) on delete set null,
  add column if not exists salon_staff_assignment_id uuid references public.frizi_salon_staff_assignments(id) on delete set null,
  add column if not exists salon_booking_note text;

alter table public.frizi_appointments
  drop constraint if exists frizi_appointments_status_check,
  add constraint frizi_appointments_status_check
    check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed', 'requested', 'expired', 'no_show'));

create index if not exists frizi_appointments_salon_starts_idx
  on public.frizi_appointments (salon_id, starts_at);

create index if not exists frizi_appointments_salon_staff_starts_idx
  on public.frizi_appointments (salon_staff_assignment_id, starts_at);

create or replace function public.frizi_salon_assignment_for_professional(target_professional_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  assignment_id uuid;
  assignment_count integer;
begin
  select count(*), min(id)
  into assignment_count, assignment_id
  from public.frizi_salon_staff_assignments
  where professional_id = target_professional_id
    and employment_status = 'active';

  if assignment_count = 1 then
    return assignment_id;
  end if;

  return null;
end;
$$;

create or replace function public.frizi_salon_shift_covers(
  target_staff_assignment_id uuid,
  target_starts_at timestamptz,
  target_ends_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.frizi_salon_shifts shift
    where shift.staff_assignment_id = target_staff_assignment_id
      and shift.status = 'published'
      and shift.starts_at <= target_starts_at
      and shift.ends_at >= target_ends_at
  )
$$;

create or replace function public.frizi_validate_salon_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment record;
  service record;
  inferred_assignment_id uuid;
  effective_end timestamptz;
begin
  effective_end := coalesce(new.ends_at, new.starts_at + interval '30 minutes');

  if new.status in ('pending', 'confirmed', 'requested') and effective_end <= new.starts_at then
    raise exception 'Appointment end time must be after start time.'
      using errcode = '22007';
  end if;

  if new.salon_staff_assignment_id is null then
    inferred_assignment_id := public.frizi_salon_assignment_for_professional(new.professional_id);
    if inferred_assignment_id is not null then
      new.salon_staff_assignment_id := inferred_assignment_id;
    end if;
  end if;

  if new.salon_staff_assignment_id is not null then
    select *
    into assignment
    from public.frizi_salon_staff_assignments
    where id = new.salon_staff_assignment_id
      and employment_status = 'active';

    if assignment.id is null then
      raise exception 'This staff member is not active for salon booking.'
        using errcode = '23514';
    end if;

    if assignment.professional_id is null then
      raise exception 'Connect this staff member to a Frizi Pro profile before booking.'
        using errcode = '23514';
    end if;

    if assignment.professional_id <> new.professional_id then
      raise exception 'The selected service provider does not match the salon staff record.'
        using errcode = '23514';
    end if;

    new.salon_id := coalesce(new.salon_id, assignment.salon_id);
    new.salon_location_id := coalesce(new.salon_location_id, assignment.location_id);

    if new.salon_id <> assignment.salon_id then
      raise exception 'The appointment salon does not match the staff assignment.'
        using errcode = '23514';
    end if;

    if new.salon_location_id is not null
      and assignment.location_id is not null
      and new.salon_location_id <> assignment.location_id then
      raise exception 'The appointment location does not match the staff assignment.'
        using errcode = '23514';
    end if;

    if new.status in ('pending', 'confirmed', 'requested')
      and not public.frizi_salon_shift_covers(new.salon_staff_assignment_id, new.starts_at, effective_end) then
      raise exception 'This time is outside the published salon schedule.'
        using errcode = '23514';
    end if;
  end if;

  if new.service_id is not null then
    select id, professional_id, name, base_price_cents, duration_minutes, active
    into service
    from public.frizi_services
    where id = new.service_id;

    if service.id is null or service.active is not true then
      raise exception 'Choose an active service for this booking.'
        using errcode = '23514';
    end if;

    if service.professional_id <> new.professional_id::text then
      raise exception 'The selected service does not belong to this professional.'
        using errcode = '23514';
    end if;

    new.service_snapshot := coalesce(nullif(new.service_snapshot, '{}'::jsonb), jsonb_build_object(
      'name', service.name,
      'base_price_cents', service.base_price_cents,
      'duration_minutes', service.duration_minutes
    ));
  end if;

  return new;
end;
$$;

drop trigger if exists frizi_validate_salon_appointment_trigger on public.frizi_appointments;
create trigger frizi_validate_salon_appointment_trigger
before insert or update of salon_id, salon_location_id, salon_staff_assignment_id, professional_id, service_id, starts_at, ends_at, status
on public.frizi_appointments
for each row
execute function public.frizi_validate_salon_appointment();

drop policy if exists "salon members can read salon appointments" on public.frizi_appointments;
create policy "salon members can read salon appointments"
on public.frizi_appointments
for select
to authenticated
using (
  salon_id is not null
  and public.frizi_is_salon_member(salon_id)
);

drop policy if exists "salon members can create salon appointments" on public.frizi_appointments;
create policy "salon members can create salon appointments"
on public.frizi_appointments
for insert
to authenticated
with check (
  salon_id is not null
  and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
);

drop policy if exists "salon members can update salon appointments" on public.frizi_appointments;
create policy "salon members can update salon appointments"
on public.frizi_appointments
for update
to authenticated
using (
  salon_id is not null
  and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
)
with check (
  salon_id is not null
  and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
);

drop policy if exists "salon staff can read own assigned appointments" on public.frizi_appointments;
create policy "salon staff can read own assigned appointments"
on public.frizi_appointments
for select
to authenticated
using (
  salon_staff_assignment_id is not null
  and public.frizi_is_current_salon_staff_assignment(salon_staff_assignment_id)
);

drop policy if exists "salon members can create manual CRM clients" on public.frizi_clients;
create policy "salon members can create manual CRM clients"
on public.frizi_clients
for insert
to authenticated
with check (
  profile_id is null
  and exists (
    select 1
    from public.frizi_salon_staff_assignments assignment
    where assignment.professional_id = frizi_clients.created_by_professional_id
      and assignment.employment_status = 'active'
      and public.frizi_is_salon_member(assignment.salon_id, array['owner', 'manager', 'reception'])
  )
);

grant select, insert, update on public.frizi_appointments to authenticated;
grant select, insert, update on public.frizi_clients to authenticated;

revoke all on function public.frizi_salon_assignment_for_professional(uuid) from public;
revoke all on function public.frizi_salon_shift_covers(uuid, timestamptz, timestamptz) from public;
grant execute on function public.frizi_salon_assignment_for_professional(uuid) to authenticated;
grant execute on function public.frizi_salon_shift_covers(uuid, timestamptz, timestamptz) to authenticated;

comment on column public.frizi_appointments.salon_id is
  'Optional salon context for the canonical appointment. Salon does not use a separate appointment table.';

comment on column public.frizi_appointments.salon_staff_assignment_id is
  'Salon staff row assigned to this canonical appointment when the booking is salon-managed.';
