drop index if exists public.frizi_appointments_no_active_slot_overlap_idx;

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
  if new.status not in ('pending', 'confirmed') then
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
    and existing.status in ('pending', 'confirmed')
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

drop trigger if exists frizi_appointments_reject_active_overlap on public.frizi_appointments;
create trigger frizi_appointments_reject_active_overlap
before insert or update of professional_id, starts_at, ends_at, status
on public.frizi_appointments
for each row
execute function public.frizi_reject_overlapping_active_appointments();
