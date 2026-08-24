-- Phase 10: Salon reviews and reputation attribution.
-- Reviews stay in the canonical frizi_reviews table; Salon adds attribution and
-- reputation eligibility without taking history away from the professional.

alter table public.frizi_reviews
  add column if not exists salon_id uuid references public.frizi_salons(id) on delete set null,
  add column if not exists salon_location_id uuid references public.frizi_salon_locations(id) on delete set null,
  add column if not exists salon_staff_assignment_id uuid references public.frizi_salon_staff_assignments(id) on delete set null,
  add column if not exists performed_by_professional_id uuid references public.frizi_professionals(id) on delete set null,
  add column if not exists verified_appointment boolean not null default false,
  add column if not exists salon_reputation_eligible boolean not null default false,
  add column if not exists professional_reputation_eligible boolean not null default true,
  add column if not exists attribution_source text not null default 'professional_booking'
    check (attribution_source in ('professional_booking', 'salon_booking', 'walk_in', 'imported_history')),
  add column if not exists service_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists consent_snapshot jsonb not null default '{}'::jsonb;

create index if not exists frizi_reviews_salon_public_idx
  on public.frizi_reviews (salon_id, public_status, created_at desc)
  where salon_id is not null;

create index if not exists frizi_reviews_performed_by_professional_idx
  on public.frizi_reviews (performed_by_professional_id, public_status, created_at desc)
  where performed_by_professional_id is not null;

create or replace function public.frizi_apply_review_attribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_row public.frizi_appointments%rowtype;
begin
  if new.appointment_id is null then
    new.performed_by_professional_id := coalesce(new.performed_by_professional_id, new.professional_id);
    new.verified_appointment := false;
    new.salon_reputation_eligible := false;
    if new.public_status = 'published' then
      raise exception 'Only completed appointment reviews can be published';
    end if;
    return new;
  end if;

  select *
  into appointment_row
  from public.frizi_appointments
  where id = new.appointment_id;

  if appointment_row.id is null then
    raise exception 'Review appointment was not found';
  end if;

  if appointment_row.client_id <> new.client_id then
    raise exception 'Review client does not match appointment';
  end if;

  if appointment_row.professional_id <> new.professional_id then
    raise exception 'Review professional does not match appointment';
  end if;

  new.salon_id := coalesce(new.salon_id, appointment_row.salon_id);
  new.salon_location_id := coalesce(new.salon_location_id, appointment_row.salon_location_id);
  new.salon_staff_assignment_id := coalesce(new.salon_staff_assignment_id, appointment_row.salon_staff_assignment_id);
  new.performed_by_professional_id := coalesce(new.performed_by_professional_id, appointment_row.professional_id, new.professional_id);
  new.attribution_source := case
    when appointment_row.booking_source = 'walk_in' then 'walk_in'
    when appointment_row.salon_id is not null then 'salon_booking'
    else 'professional_booking'
  end;
  new.service_snapshot := coalesce(nullif(new.service_snapshot, '{}'::jsonb), appointment_row.service_snapshot, '{}'::jsonb);
  new.verified_appointment := appointment_row.status = 'completed';
  new.salon_reputation_eligible := appointment_row.salon_id is not null and appointment_row.status = 'completed';
  new.professional_reputation_eligible := appointment_row.status = 'completed';

  if new.public_status = 'published' and new.verified_appointment is not true then
    raise exception 'Only completed appointment reviews can be published';
  end if;

  return new;
end;
$$;

drop trigger if exists frizi_apply_review_attribution_trigger on public.frizi_reviews;
create trigger frizi_apply_review_attribution_trigger
before insert or update of appointment_id, client_id, professional_id, public_status
on public.frizi_reviews
for each row
execute function public.frizi_apply_review_attribution();

revoke all on function public.frizi_apply_review_attribution() from public;

create or replace function public.frizi_salon_review_summary(target_salon_id uuid)
returns table (
  salon_id uuid,
  review_count integer,
  average_rating numeric,
  latest_review_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    target_salon_id,
    count(*)::integer,
    round(avg(review.rating)::numeric, 2),
    max(review.created_at)
  from public.frizi_reviews review
  where review.salon_id = target_salon_id
    and review.public_status = 'published'
    and review.salon_reputation_eligible = true;
$$;

drop policy if exists "salon members can read salon reviews" on public.frizi_reviews;
create policy "salon members can read salon reviews"
on public.frizi_reviews
for select
to authenticated
using (salon_id is not null and public.frizi_is_salon_member(salon_id));

drop policy if exists "professionals can read attributed reviews" on public.frizi_reviews;
create policy "professionals can read attributed reviews"
on public.frizi_reviews
for select
to authenticated
using (
  professional_id = public.frizi_current_professional_id()
  or performed_by_professional_id = public.frizi_current_professional_id()
);

drop policy if exists "clients can create own appointment reviews" on public.frizi_reviews;
create policy "clients can create own appointment reviews"
on public.frizi_reviews
for insert
to authenticated
with check (client_id = public.frizi_current_client_id());

drop policy if exists "clients can update own unpublished reviews" on public.frizi_reviews;
create policy "clients can update own unpublished reviews"
on public.frizi_reviews
for update
to authenticated
using (client_id = public.frizi_current_client_id() and public_status <> 'published')
with check (client_id = public.frizi_current_client_id() and public_status <> 'published');

grant select, insert, update on public.frizi_reviews to authenticated;
grant execute on function public.frizi_salon_review_summary(uuid) to authenticated;

comment on column public.frizi_reviews.salon_id is
  'Salon attribution for reviews created from Salon-booked appointments. Published verified reviews may contribute to Salon reputation.';

comment on column public.frizi_reviews.performed_by_professional_id is
  'Professional who performed the service. This supports personal Pro work history if staff later upgrades without removing Salon historical relevance.';

comment on column public.frizi_reviews.verified_appointment is
  'True only when the linked appointment is completed and matches the review client/professional.';

comment on column public.frizi_reviews.professional_reputation_eligible is
  'Allows product policy to include historical verified reviews on a personal Pro profile when appropriate.';
