alter table public.frizi_salon_staff_assignments
  add column if not exists target_weekly_minutes integer,
  add column if not exists scheduling_notes text;

alter table public.frizi_salon_memberships
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  add column if not exists end_reason text,
  add column if not exists end_source text
    check (end_source is null or end_source in ('removed_by_salon', 'left_by_professional'));

alter table public.frizi_salon_staff_availability
  add column if not exists conflict_status text not null default 'none'
    check (conflict_status in ('none', 'published_shift_conflict')),
  add column if not exists conflict_note text;

create index if not exists frizi_salon_staff_assignments_target_hours_idx
  on public.frizi_salon_staff_assignments (salon_id, employment_status, target_weekly_minutes);

create or replace function public.frizi_remove_salon_professional(
  target_staff_assignment_id uuid,
  removal_reason text default 'removed_by_salon'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment_row record;
  future_appointments integer := 0;
  current_profile uuid;
  recipient_user uuid;
begin
  current_profile := public.frizi_current_profile_id();

  select *
  into assignment_row
  from public.frizi_salon_staff_assignments
  where id = target_staff_assignment_id;

  if assignment_row.id is null then
    raise exception 'Team member was not found.' using errcode = 'P0002';
  end if;

  if not public.frizi_can_manage_salon(assignment_row.salon_id) then
    raise exception 'You cannot remove this team member.' using errcode = '42501';
  end if;

  select count(*)
  into future_appointments
  from public.frizi_appointments appointment
  where appointment.salon_staff_assignment_id = target_staff_assignment_id
    and appointment.starts_at >= now()
    and appointment.status in ('pending', 'confirmed', 'requested');

  if future_appointments > 0 then
    raise exception '% has % upcoming appointment(s). Resolve these appointments before removing them.',
      coalesce(assignment_row.display_name, 'This professional'),
      future_appointments
      using errcode = 'P0001';
  end if;

  update public.frizi_salon_shifts
  set status = 'cancelled',
      schedule_note = coalesce(schedule_note || ' ', '') || 'Cancelled because Salon membership ended.',
      updated_at = now()
  where staff_assignment_id = target_staff_assignment_id
    and starts_at >= now()
    and status in ('draft', 'published', 'changed');

  update public.frizi_salon_staff_assignments
  set employment_status = 'inactive',
      connection_status = 'inactive',
      ended_on = current_date,
      scheduling_notes = coalesce(removal_reason, 'removed_by_salon'),
      updated_at = now()
  where id = target_staff_assignment_id;

  if assignment_row.membership_id is not null then
    update public.frizi_salon_memberships
    set status = 'removed',
        ended_at = now(),
        ended_by_profile_id = current_profile,
        end_reason = coalesce(removal_reason, 'removed_by_salon'),
        end_source = 'removed_by_salon',
        updated_at = now()
    where id = assignment_row.membership_id;
  end if;

  select profile.auth_user_id
  into recipient_user
  from public.frizi_profiles profile
  where profile.id = assignment_row.staff_profile_id
    and profile.auth_user_id is not null;

  if recipient_user is not null then
    insert into public.frizi_notifications (
      recipient_user_id,
      recipient_role,
      notification_type,
      title,
      body,
      professional_id,
      action_path,
      source_key,
      metadata
    )
    values (
      recipient_user,
      'professional',
      'salon_connection_removed',
      'Salon connection ended',
      'You''re no longer connected to ' || coalesce((select name from public.frizi_salons where id = assignment_row.salon_id), 'this Salon') || '. Your Frizi Professional account is still active.',
      assignment_row.professional_id,
      '/dashboard',
      'salon_connection_removed:' || target_staff_assignment_id::text || ':' || now()::date::text,
      jsonb_build_object('salon_id', assignment_row.salon_id, 'staff_assignment_id', target_staff_assignment_id)
    )
    on conflict (source_key) do nothing;
  end if;

  return jsonb_build_object(
    'removed', true,
    'staffAssignmentId', target_staff_assignment_id,
    'futureAppointments', future_appointments
  );
end;
$$;

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

  return jsonb_build_object(
    'left', true,
    'salonId', target_salon_id,
    'staffAssignmentId', assignment_row.id,
    'futureAppointments', future_appointments
  );
end;
$$;

revoke all on function public.frizi_remove_salon_professional(uuid, text) from public;
revoke all on function public.frizi_leave_salon_as_professional(uuid) from public;
grant execute on function public.frizi_remove_salon_professional(uuid, text) to authenticated;
grant execute on function public.frizi_leave_salon_as_professional(uuid) to authenticated;

comment on column public.frizi_salon_staff_assignments.target_weekly_minutes is
  'Optional scheduling preference for Smart Scheduling. This is not payroll.';

comment on function public.frizi_remove_salon_professional(uuid, text) is
  'Manager-owned removal workflow: preserves professional identity, blocks unresolved future appointments, ends membership history, and cancels future Salon shifts.';

comment on function public.frizi_leave_salon_as_professional(uuid) is
  'Professional-owned Salon leave workflow: preserves the Frizi Professional account and ends only the active Salon connection.';
