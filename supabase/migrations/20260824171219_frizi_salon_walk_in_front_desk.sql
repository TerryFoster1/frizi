-- Phase 5: walk-in queue and front-desk appointment lifecycle.

alter table public.frizi_appointments
  drop constraint if exists frizi_appointments_status_check,
  add constraint frizi_appointments_status_check
    check (status in (
      'pending',
      'confirmed',
      'arrived',
      'in_service',
      'declined',
      'cancelled',
      'completed',
      'requested',
      'expired',
      'no_show'
    ));

create table if not exists public.frizi_salon_walk_ins (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  salon_location_id uuid references public.frizi_salon_locations(id) on delete set null,
  client_id uuid references public.frizi_clients(id) on delete set null,
  client_name text,
  client_phone text,
  client_email text,
  desired_service_name text not null,
  requested_service_id text references public.frizi_services(id) on delete set null,
  preferences text,
  entered_at timestamptz not null default now(),
  status text not null default 'waiting'
    check (status in ('waiting', 'assigned', 'cancelled', 'completed', 'invited_to_client_app')),
  assigned_staff_assignment_id uuid references public.frizi_salon_staff_assignments(id) on delete set null,
  assigned_professional_id uuid references public.frizi_professionals(id) on delete set null,
  appointment_id uuid references public.frizi_appointments(id) on delete set null,
  invite_sent_at timestamptz,
  created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id is not null or nullif(trim(client_name), '') is not null)
);

alter table public.frizi_salon_walk_ins enable row level security;

create index if not exists frizi_salon_walk_ins_queue_idx
  on public.frizi_salon_walk_ins (salon_id, status, entered_at);

create index if not exists frizi_salon_walk_ins_appointment_idx
  on public.frizi_salon_walk_ins (appointment_id)
  where appointment_id is not null;

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

create or replace function public.frizi_notify_salon_appointment_to_professional()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pro_user_id uuid;
  client_label text;
begin
  if new.salon_id is null then
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
    case when new.booking_source = 'walk_in' then 'walk_in_assigned' else 'salon_booking_created' end,
    case when new.booking_source = 'walk_in' then 'Walk-in assigned' else 'Salon booking created' end,
    client_label || ' is booked for ' || to_char(new.starts_at at time zone 'America/Toronto', 'Mon FMDD, FMHH12:MI AM') || '.',
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
      'booking_source', new.booking_source
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

drop trigger if exists frizi_notify_salon_appointment_to_professional_trigger on public.frizi_appointments;
create trigger frizi_notify_salon_appointment_to_professional_trigger
after insert or update of status, starts_at, ends_at, salon_staff_assignment_id
on public.frizi_appointments
for each row
when (new.salon_id is not null and new.status in ('pending', 'confirmed', 'arrived', 'in_service'))
execute function public.frizi_notify_salon_appointment_to_professional();

drop policy if exists "salon front desk can manage walk ins" on public.frizi_salon_walk_ins;
create policy "salon front desk can manage walk ins"
on public.frizi_salon_walk_ins
for all
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon staff can read assigned walk ins" on public.frizi_salon_walk_ins;
create policy "salon staff can read assigned walk ins"
on public.frizi_salon_walk_ins
for select
to authenticated
using (
  assigned_staff_assignment_id is not null
  and public.frizi_is_current_salon_staff_assignment(assigned_staff_assignment_id)
);

grant select, insert, update on public.frizi_salon_walk_ins to authenticated;

comment on table public.frizi_salon_walk_ins is
  'Front-desk walk-in queue. Assignment creates a canonical frizi_appointments row rather than a separate booking record.';
