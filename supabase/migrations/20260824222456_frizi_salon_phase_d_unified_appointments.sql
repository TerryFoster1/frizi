-- Frizi Salon Phase D: unified canonical appointments for Salon, Pro, and Client.
-- Salon still writes public.frizi_appointments. Calendar-only staff can now be
-- booked without creating a professional/Auth identity, while linked staff keep
-- the same appointment visible to Pro and Client through the canonical row.

alter table public.frizi_appointments
  alter column professional_id drop not null;

alter table public.frizi_appointments
  drop constraint if exists frizi_appointments_booking_source_check,
  add constraint frizi_appointments_booking_source_check
    check (booking_source in (
      'client_app',
      'client_frizi',
      'pro_manual',
      'salon_app',
      'salon_manual',
      'salon_walkin',
      'walk_in',
      'salon_website_future',
      'waitlist_future',
      'other'
    ));

create index if not exists frizi_appointments_salon_active_staff_range_idx
  on public.frizi_appointments (salon_id, salon_staff_assignment_id, starts_at)
  where status in ('pending', 'confirmed', 'requested', 'arrived', 'in_service');

create or replace function public.frizi_reject_overlapping_active_appointments()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  conflicting_id uuid;
  next_end timestamptz;
begin
  if new.status not in ('pending', 'confirmed', 'requested', 'arrived', 'in_service') then
    return new;
  end if;

  next_end := coalesce(new.ends_at, new.starts_at + interval '30 minutes');

  if next_end <= new.starts_at then
    raise exception 'Appointment end time must be after start time.'
      using errcode = '22007';
  end if;

  if new.professional_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text, 0));

  select existing.id
  into conflicting_id
  from public.frizi_appointments existing
  where existing.professional_id = new.professional_id
    and existing.status in ('pending', 'confirmed', 'requested', 'arrived', 'in_service')
    and existing.id is distinct from new.id
    and existing.starts_at < next_end
    and coalesce(existing.ends_at, existing.starts_at + interval '30 minutes') > new.starts_at
  limit 1;

  if conflicting_id is not null then
    raise exception 'That time is no longer available.'
      using errcode = '23P01';
  end if;

  return new;
end;
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

  if new.professional_id is not null and new.salon_staff_assignment_id is null then
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

    if new.professional_id is null and assignment.professional_id is not null then
      new.professional_id := assignment.professional_id;
    end if;

    if assignment.professional_id is not null and assignment.professional_id <> new.professional_id then
      raise exception 'The selected service provider does not match the salon staff record.'
        using errcode = '23514';
    end if;

    if assignment.professional_id is null and new.service_id is not null then
      raise exception 'Calendar-only staff can use an appointment label, not a professional service.'
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

  if new.salon_id is not null and new.salon_staff_assignment_id is null then
    raise exception 'Choose a team member for this Salon appointment.'
      using errcode = '23514';
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

    if new.professional_id is null then
      raise exception 'Choose a professional before using a structured service.'
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

  new.service_snapshot := coalesce(nullif(new.service_snapshot, '{}'::jsonb), jsonb_build_object(
    'name', 'Appointment',
    'duration_minutes', extract(epoch from (effective_end - new.starts_at))::integer / 60
  ));

  return new;
end;
$$;

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
    raise exception 'That time is no longer available.'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

create or replace function public.frizi_notify_salon_appointment_to_professional()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pro_user_id uuid;
  client_label text;
  appointment_label text;
begin
  if new.salon_id is null or new.professional_id is null then
    return new;
  end if;

  select profile.auth_user_id
  into pro_user_id
  from public.frizi_professionals professional
  join public.frizi_profiles profile on profile.id = professional.profile_id
  where professional.id = new.professional_id
  limit 1;

  if pro_user_id is null then
    return new;
  end if;

  select coalesce(client.preferred_name, client.first_name, client.email, 'A client')
  into client_label
  from public.frizi_clients client
  where client.id = new.client_id
  limit 1;

  appointment_label := coalesce(new.service_snapshot->>'name', 'Appointment');

  insert into public.frizi_notifications (
    recipient_user_id,
    recipient_role,
    notification_type,
    title,
    body,
    professional_id,
    client_id,
    appointment_id,
    action_path,
    source_key,
    metadata
  )
  values (
    pro_user_id,
    'professional',
    case when new.booking_source in ('walk_in', 'salon_walkin') then 'walk_in_assigned' else 'salon_booking_created' end,
    case when new.booking_source in ('walk_in', 'salon_walkin') then 'Walk-in assigned' else 'Salon booking created' end,
    client_label || ' is booked for ' || appointment_label || ' on ' || to_char(new.starts_at at time zone 'America/Toronto', 'Mon FMDD, FMHH12:MI AM') || '.',
    new.professional_id,
    new.client_id,
    new.id,
    '/calendar',
    'salon_appointment:' || new.id::text || ':professional',
    jsonb_build_object(
      'salon_id', new.salon_id,
      'salon_location_id', new.salon_location_id,
      'salon_staff_assignment_id', new.salon_staff_assignment_id,
      'status', new.status,
      'booking_source', new.booking_source,
      'appointment_label', appointment_label
    )
  )
  on conflict (source_key) do update
  set
    title = excluded.title,
    body = excluded.body,
    metadata = excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

comment on column public.frizi_appointments.professional_id is
  'Nullable only for Salon calendar-only staff appointments. Linked Salon, Pro, and Client appointments use the canonical professional id.';

comment on constraint frizi_appointments_booking_source_check on public.frizi_appointments is
  'Canonical appointment origin. Salon manual and walk-in bookings share public.frizi_appointments with Pro and Client.';
