create table if not exists public.frizi_salon_operational_alerts (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  staff_assignment_id uuid references public.frizi_salon_staff_assignments(id) on delete set null,
  professional_id uuid references public.frizi_professionals(id) on delete set null,
  alert_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  source_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists frizi_salon_operational_alerts_source_key_idx
  on public.frizi_salon_operational_alerts (source_key)
  where source_key is not null;

create index if not exists frizi_salon_operational_alerts_salon_status_idx
  on public.frizi_salon_operational_alerts (salon_id, status, created_at desc);

alter table public.frizi_salon_operational_alerts enable row level security;

drop policy if exists "salon members can read operational alerts" on public.frizi_salon_operational_alerts;
create policy "salon members can read operational alerts"
on public.frizi_salon_operational_alerts
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "owners and managers can manage operational alerts" on public.frizi_salon_operational_alerts;
create policy "owners and managers can manage operational alerts"
on public.frizi_salon_operational_alerts
for update
to authenticated
using (public.frizi_can_manage_salon(salon_id))
with check (public.frizi_can_manage_salon(salon_id));

grant select, update on public.frizi_salon_operational_alerts to authenticated;

create or replace function public.frizi_leave_salon_as_professional(target_salon_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_profile uuid;
  current_professional uuid;
  assignment_row record;
  future_appointments integer := 0;
  salon_name text;
begin
  current_profile := public.frizi_current_profile_id();

  select professional.id
  into current_professional
  from public.frizi_professionals professional
  where professional.profile_id = current_profile
  limit 1;

  select *
  into assignment_row
  from public.frizi_salon_staff_assignments
  where salon_id = target_salon_id
    and staff_profile_id = current_profile
    and (professional_id = current_professional or current_professional is null)
    and employment_status = 'active'
  order by updated_at desc
  limit 1;

  if assignment_row.id is null then
    raise exception 'No active Salon connection was found.' using errcode = 'P0002';
  end if;

  select count(*)
  into future_appointments
  from public.frizi_appointments appointment
  where appointment.salon_staff_assignment_id = assignment_row.id
    and appointment.starts_at >= now()
    and appointment.status in ('pending', 'confirmed', 'requested');

  update public.frizi_salon_shifts
  set status = 'cancelled',
      schedule_note = coalesce(schedule_note || ' ', '') || 'Cancelled because the professional left the Salon.',
      updated_at = now()
  where staff_assignment_id = assignment_row.id
    and starts_at >= now()
    and status in ('draft', 'published', 'changed');

  update public.frizi_salon_staff_assignments
  set employment_status = 'inactive',
      connection_status = 'inactive',
      ended_on = current_date,
      scheduling_notes = 'left_by_professional',
      updated_at = now()
  where id = assignment_row.id;

  if assignment_row.membership_id is not null then
    update public.frizi_salon_memberships
    set status = 'removed',
        ended_at = now(),
        ended_by_profile_id = current_profile,
        end_reason = 'left_by_professional',
        end_source = 'left_by_professional',
        updated_at = now()
    where id = assignment_row.membership_id;
  end if;

  if future_appointments > 0 then
    select name into salon_name from public.frizi_salons where id = target_salon_id;
    insert into public.frizi_salon_operational_alerts (
      salon_id,
      staff_assignment_id,
      professional_id,
      alert_type,
      severity,
      title,
      body,
      source_key,
      metadata
    )
    values (
      target_salon_id,
      assignment_row.id,
      assignment_row.professional_id,
      'professional_left_with_future_appointments',
      'warning',
      'Professional left Salon',
      coalesce(assignment_row.display_name, 'A professional') || ' left ' || coalesce(salon_name, 'the Salon') || ' with ' || future_appointments || ' upcoming appointment(s). Resolve these appointments before the schedule is final.',
      'professional_left_with_future_appointments:' || assignment_row.id::text || ':' || now()::date::text,
      jsonb_build_object('future_appointments', future_appointments, 'salon_id', target_salon_id, 'staff_assignment_id', assignment_row.id)
    )
    on conflict (source_key) do update
      set body = excluded.body,
          status = 'open',
          metadata = excluded.metadata,
          updated_at = now();
  end if;

  return jsonb_build_object(
    'left', true,
    'salonId', target_salon_id,
    'staffAssignmentId', assignment_row.id,
    'futureAppointments', future_appointments
  );
end;
$$;

revoke all on function public.frizi_leave_salon_as_professional(uuid) from public;
grant execute on function public.frizi_leave_salon_as_professional(uuid) to authenticated;

comment on table public.frizi_salon_operational_alerts is
  'Salon-owned operational alerts for scheduling states that need manager attention, such as a connected professional leaving with future appointments.';
