-- Frizi Salon waitlists, cancellation policy foundation, deposits, and no-show handling.
-- This is additive and keeps bookings in the canonical frizi_appointments table.

alter table public.frizi_appointments
  drop constraint if exists frizi_appointments_status_check,
  add constraint frizi_appointments_status_check
    check (
      status in (
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
      )
    );

alter table public.frizi_services
  add column if not exists cancellation_policy_override jsonb not null default '{}'::jsonb;

create table if not exists public.frizi_salon_cancellation_policies (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  name text not null default 'Default policy',
  policy_version text not null default 'v1',
  free_cancellation_hours integer not null default 24 check (free_cancellation_hours >= 0),
  reschedule_window_hours integer not null default 12 check (reschedule_window_hours >= 0),
  deposit_forfeiture_enabled boolean not null default true,
  late_cancel_fee_cents integer not null default 0 check (late_cancel_fee_cents >= 0),
  no_show_fee_cents integer not null default 0 check (no_show_fee_cents >= 0),
  currency text not null default 'cad',
  policy_summary text not null default 'Cancel at least 24 hours before your appointment to avoid late cancellation charges.',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, policy_version)
);

create table if not exists public.frizi_salon_waitlist_requests (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  salon_location_id uuid references public.frizi_salon_locations(id) on delete set null,
  client_id uuid not null references public.frizi_clients(id) on delete cascade,
  service_id text references public.frizi_services(id) on delete set null,
  desired_service_name text not null,
  preferred_professional_id uuid references public.frizi_professionals(id) on delete set null,
  preferred_date date,
  preferred_day_of_week integer check (preferred_day_of_week is null or preferred_day_of_week between 0 and 6),
  earliest_time time,
  latest_time time,
  accepts_alternate_professional boolean not null default true,
  status text not null default 'active' check (status in ('active', 'notified', 'claimed', 'expired', 'cancelled')),
  source text not null default 'client_app' check (source in ('client_app', 'salon_app', 'phone', 'walk_in')),
  notes text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_salon_waitlist_openings (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  salon_location_id uuid references public.frizi_salon_locations(id) on delete set null,
  source_appointment_id uuid references public.frizi_appointments(id) on delete set null,
  professional_id uuid not null references public.frizi_professionals(id) on delete cascade,
  salon_staff_assignment_id uuid references public.frizi_salon_staff_assignments(id) on delete set null,
  service_id text references public.frizi_services(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'open' check (status in ('open', 'claimed', 'expired', 'cancelled')),
  claimed_by_waitlist_request_id uuid references public.frizi_salon_waitlist_requests(id) on delete set null,
  claimed_appointment_id uuid references public.frizi_appointments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_salon_waitlist_claims (
  id uuid primary key default gen_random_uuid(),
  opening_id uuid not null references public.frizi_salon_waitlist_openings(id) on delete cascade,
  waitlist_request_id uuid not null references public.frizi_salon_waitlist_requests(id) on delete cascade,
  client_id uuid not null references public.frizi_clients(id) on delete cascade,
  appointment_id uuid references public.frizi_appointments(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'lost_race', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists frizi_salon_waitlist_claims_one_winner_idx
  on public.frizi_salon_waitlist_claims (opening_id)
  where status = 'claimed';

create table if not exists public.frizi_appointment_policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.frizi_appointments(id) on delete cascade,
  client_id uuid not null references public.frizi_clients(id) on delete cascade,
  professional_id uuid references public.frizi_professionals(id) on delete set null,
  salon_id uuid references public.frizi_salons(id) on delete set null,
  policy_id uuid references public.frizi_salon_cancellation_policies(id) on delete set null,
  policy_version text not null,
  accepted_at timestamptz not null default now(),
  acceptance_source text not null default 'client_app' check (acceptance_source in ('client_app', 'salon_app', 'phone', 'walk_in')),
  acceptance_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.frizi_payment_method_refs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.frizi_profiles(id) on delete cascade,
  client_id uuid references public.frizi_clients(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_payment_method_id text not null,
  card_brand text,
  card_last4 text,
  exp_month integer check (exp_month is null or exp_month between 1 and 12),
  exp_year integer check (exp_year is null or exp_year >= 2026),
  usage_context text not null default 'booking_policy' check (usage_context in ('booking_policy', 'subscription', 'marketplace')),
  status text not null default 'active' check (status in ('active', 'inactive', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, stripe_payment_method_id)
);

alter table public.frizi_appointments
  add column if not exists cancellation_policy_id uuid references public.frizi_salon_cancellation_policies(id) on delete set null,
  add column if not exists cancellation_policy_version text,
  add column if not exists policy_accepted_at timestamptz,
  add column if not exists policy_acceptance_id uuid references public.frizi_appointment_policy_acceptances(id) on delete set null,
  add column if not exists deposit_required_cents integer not null default 0 check (deposit_required_cents >= 0),
  add column if not exists late_cancel_fee_cents integer not null default 0 check (late_cancel_fee_cents >= 0),
  add column if not exists no_show_fee_cents integer not null default 0 check (no_show_fee_cents >= 0),
  add column if not exists waitlist_request_id uuid references public.frizi_salon_waitlist_requests(id) on delete set null,
  add column if not exists no_show_marked_at timestamptz,
  add column if not exists no_show_marked_by_profile_id uuid references public.frizi_profiles(id) on delete set null;

create index if not exists frizi_salon_waitlist_requests_salon_status_idx
  on public.frizi_salon_waitlist_requests (salon_id, status, preferred_date);

create index if not exists frizi_salon_waitlist_openings_salon_status_idx
  on public.frizi_salon_waitlist_openings (salon_id, status, starts_at);

create index if not exists frizi_appointments_waitlist_request_idx
  on public.frizi_appointments (waitlist_request_id)
  where waitlist_request_id is not null;

alter table public.frizi_salon_cancellation_policies enable row level security;
alter table public.frizi_salon_waitlist_requests enable row level security;
alter table public.frizi_salon_waitlist_openings enable row level security;
alter table public.frizi_salon_waitlist_claims enable row level security;
alter table public.frizi_appointment_policy_acceptances enable row level security;
alter table public.frizi_payment_method_refs enable row level security;

create or replace function public.frizi_salon_request_matches_opening(
  target_request public.frizi_salon_waitlist_requests,
  target_opening public.frizi_salon_waitlist_openings
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return target_request.salon_id = target_opening.salon_id
    and target_request.status in ('active', 'notified')
    and (target_request.expires_at is null or target_request.expires_at > now())
    and (
      target_request.service_id is null
      or target_opening.service_id is null
      or target_request.service_id = target_opening.service_id
    )
    and (
      target_request.preferred_professional_id is null
      or target_request.preferred_professional_id = target_opening.professional_id
      or target_request.accepts_alternate_professional = true
    )
    and (
      target_request.preferred_date is null
      or target_request.preferred_date = (target_opening.starts_at at time zone current_setting('TimeZone'))::date
    )
    and (
      target_request.preferred_day_of_week is null
      or target_request.preferred_day_of_week = extract(dow from target_opening.starts_at)::integer
    )
    and (
      target_request.earliest_time is null
      or target_request.earliest_time <= (target_opening.starts_at at time zone current_setting('TimeZone'))::time
    )
    and (
      target_request.latest_time is null
      or target_request.latest_time >= (target_opening.starts_at at time zone current_setting('TimeZone'))::time
    );
end;
$$;

create or replace function public.frizi_create_waitlist_opening_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  opening_id uuid;
  request_row public.frizi_salon_waitlist_requests%rowtype;
  client_user_id uuid;
begin
  if new.status = 'cancelled'
    and old.status is distinct from new.status
    and new.salon_id is not null
    and new.starts_at > now()
  then
    insert into public.frizi_salon_waitlist_openings (
      salon_id,
      salon_location_id,
      source_appointment_id,
      professional_id,
      salon_staff_assignment_id,
      service_id,
      starts_at,
      ends_at,
      status
    )
    values (
      new.salon_id,
      new.salon_location_id,
      new.id,
      new.professional_id,
      new.salon_staff_assignment_id,
      new.service_id,
      new.starts_at,
      new.ends_at,
      'open'
    )
    returning id into opening_id;

    for request_row in
      select *
      from public.frizi_salon_waitlist_requests request
      where public.frizi_salon_request_matches_opening(request, (
        select opening from public.frizi_salon_waitlist_openings opening where opening.id = opening_id
      ))
      order by request.created_at asc
      limit 10
    loop
      update public.frizi_salon_waitlist_requests
      set status = 'notified',
          updated_at = now()
      where id = request_row.id
        and status = 'active';

      select profile.auth_user_id
      into client_user_id
      from public.frizi_clients client_record
      join public.frizi_profiles profile on profile.id = client_record.profile_id
      where client_record.id = request_row.client_id;

      if client_user_id is not null then
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
          client_user_id,
          'client',
          'waitlist_opening',
          'An appointment opened',
          'A time you were waiting for is available. Book it before someone else claims it.',
          new.professional_id,
          request_row.client_id,
          new.id,
          '/appointments',
          'waitlist_opening:' || opening_id::text || ':' || request_row.id::text,
          jsonb_build_object('opening_id', opening_id, 'waitlist_request_id', request_row.id)
        )
        on conflict (source_key) do nothing;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists frizi_create_waitlist_opening_on_cancel_trigger on public.frizi_appointments;
create trigger frizi_create_waitlist_opening_on_cancel_trigger
after update of status
on public.frizi_appointments
for each row
execute function public.frizi_create_waitlist_opening_on_cancel();

create or replace function public.frizi_claim_salon_waitlist_opening(
  target_opening_id uuid,
  target_waitlist_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  opening public.frizi_salon_waitlist_openings%rowtype;
  request_row public.frizi_salon_waitlist_requests%rowtype;
  new_appointment_id uuid;
  client_record_id uuid;
begin
  select *
  into opening
  from public.frizi_salon_waitlist_openings
  where id = target_opening_id
  for update;

  if opening.id is null or opening.status <> 'open' then
    raise exception 'This opening is no longer available.';
  end if;

  select *
  into request_row
  from public.frizi_salon_waitlist_requests
  where id = target_waitlist_request_id
  for update;

  client_record_id := public.frizi_current_client_id();

  if request_row.id is null or request_row.client_id <> client_record_id then
    raise exception 'This waitlist request is not available to this client.';
  end if;

  if not public.frizi_salon_request_matches_opening(request_row, opening) then
    raise exception 'This opening does not match the waitlist request.';
  end if;

  update public.frizi_salon_waitlist_openings
  set status = 'claimed',
      claimed_by_waitlist_request_id = request_row.id,
      updated_at = now()
  where id = opening.id
    and status = 'open';

  if not found then
    insert into public.frizi_salon_waitlist_claims (
      opening_id,
      waitlist_request_id,
      client_id,
      status
    )
    values (opening.id, request_row.id, request_row.client_id, 'lost_race');

    raise exception 'This opening was just claimed by another client.';
  end if;

  insert into public.frizi_appointments (
    salon_id,
    salon_location_id,
    salon_staff_assignment_id,
    client_id,
    professional_id,
    service_id,
    service_snapshot,
    starts_at,
    ends_at,
    status,
    payment_status,
    booking_source,
    waitlist_request_id
  )
  values (
    opening.salon_id,
    opening.salon_location_id,
    opening.salon_staff_assignment_id,
    request_row.client_id,
    opening.professional_id,
    opening.service_id,
    '{}'::jsonb,
    opening.starts_at,
    opening.ends_at,
    'confirmed',
    'unpaid',
    'client_app',
    request_row.id
  )
  returning id into new_appointment_id;

  insert into public.frizi_salon_waitlist_claims (
    opening_id,
    waitlist_request_id,
    client_id,
    appointment_id,
    status
  )
  values (opening.id, request_row.id, request_row.client_id, new_appointment_id, 'claimed');

  update public.frizi_salon_waitlist_openings
  set claimed_appointment_id = new_appointment_id,
      updated_at = now()
  where id = opening.id;

  update public.frizi_salon_waitlist_requests
  set status = 'claimed',
      updated_at = now()
  where id = request_row.id;

  return new_appointment_id;
end;
$$;

create or replace function public.frizi_mark_salon_no_show(
  target_appointment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  appointment_row public.frizi_appointments%rowtype;
begin
  select *
  into appointment_row
  from public.frizi_appointments
  where id = target_appointment_id;

  if appointment_row.id is null then
    raise exception 'Appointment not found.';
  end if;

  if appointment_row.salon_id is null or not public.frizi_is_salon_member(appointment_row.salon_id) then
    raise exception 'You cannot update this appointment.';
  end if;

  update public.frizi_appointments
  set status = 'no_show',
      no_show_marked_at = now(),
      no_show_marked_by_profile_id = public.frizi_current_profile_id(),
      updated_at = now()
  where id = target_appointment_id;
end;
$$;

revoke all on function public.frizi_salon_request_matches_opening(public.frizi_salon_waitlist_requests, public.frizi_salon_waitlist_openings) from public;
revoke all on function public.frizi_claim_salon_waitlist_opening(uuid, uuid) from public;
revoke all on function public.frizi_mark_salon_no_show(uuid) from public;
grant execute on function public.frizi_salon_request_matches_opening(public.frizi_salon_waitlist_requests, public.frizi_salon_waitlist_openings) to authenticated;
grant execute on function public.frizi_claim_salon_waitlist_opening(uuid, uuid) to authenticated;
grant execute on function public.frizi_mark_salon_no_show(uuid) to authenticated;

drop policy if exists "salon members can manage cancellation policies" on public.frizi_salon_cancellation_policies;
create policy "salon members can manage cancellation policies"
on public.frizi_salon_cancellation_policies
for all
to authenticated
using (public.frizi_can_manage_salon(salon_id))
with check (public.frizi_can_manage_salon(salon_id));

drop policy if exists "salon members can read cancellation policies" on public.frizi_salon_cancellation_policies;
create policy "salon members can read cancellation policies"
on public.frizi_salon_cancellation_policies
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "clients can create own salon waitlist requests" on public.frizi_salon_waitlist_requests;
create policy "clients can create own salon waitlist requests"
on public.frizi_salon_waitlist_requests
for insert
to authenticated
with check (client_id = public.frizi_current_client_id());

drop policy if exists "clients can read own salon waitlist requests" on public.frizi_salon_waitlist_requests;
create policy "clients can read own salon waitlist requests"
on public.frizi_salon_waitlist_requests
for select
to authenticated
using (client_id = public.frizi_current_client_id());

drop policy if exists "clients can cancel own salon waitlist requests" on public.frizi_salon_waitlist_requests;
create policy "clients can cancel own salon waitlist requests"
on public.frizi_salon_waitlist_requests
for update
to authenticated
using (client_id = public.frizi_current_client_id())
with check (client_id = public.frizi_current_client_id());

drop policy if exists "salon members can manage waitlist requests" on public.frizi_salon_waitlist_requests;
create policy "salon members can manage waitlist requests"
on public.frizi_salon_waitlist_requests
for all
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "matching clients can read open waitlist openings" on public.frizi_salon_waitlist_openings;
create policy "matching clients can read open waitlist openings"
on public.frizi_salon_waitlist_openings
for select
to authenticated
using (
  status = 'open'
  and exists (
    select 1
    from public.frizi_salon_waitlist_requests request
    where request.client_id = public.frizi_current_client_id()
      and public.frizi_salon_request_matches_opening(request, frizi_salon_waitlist_openings)
  )
);

drop policy if exists "salon members can manage waitlist openings" on public.frizi_salon_waitlist_openings;
create policy "salon members can manage waitlist openings"
on public.frizi_salon_waitlist_openings
for all
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "clients can read own waitlist claims" on public.frizi_salon_waitlist_claims;
create policy "clients can read own waitlist claims"
on public.frizi_salon_waitlist_claims
for select
to authenticated
using (client_id = public.frizi_current_client_id());

drop policy if exists "salon members can read waitlist claims" on public.frizi_salon_waitlist_claims;
create policy "salon members can read waitlist claims"
on public.frizi_salon_waitlist_claims
for select
to authenticated
using (
  exists (
    select 1
    from public.frizi_salon_waitlist_openings opening
    where opening.id = frizi_salon_waitlist_claims.opening_id
      and public.frizi_is_salon_member(opening.salon_id)
  )
);

drop policy if exists "clients can create own policy acceptances" on public.frizi_appointment_policy_acceptances;
create policy "clients can create own policy acceptances"
on public.frizi_appointment_policy_acceptances
for insert
to authenticated
with check (client_id = public.frizi_current_client_id());

drop policy if exists "participants can read policy acceptances" on public.frizi_appointment_policy_acceptances;
create policy "participants can read policy acceptances"
on public.frizi_appointment_policy_acceptances
for select
to authenticated
using (
  client_id = public.frizi_current_client_id()
  or professional_id = public.frizi_current_professional_id()
  or (salon_id is not null and public.frizi_is_salon_member(salon_id))
);

drop policy if exists "users can manage own payment method refs" on public.frizi_payment_method_refs;
create policy "users can manage own payment method refs"
on public.frizi_payment_method_refs
for all
to authenticated
using (
  exists (
    select 1 from public.frizi_profiles profile
    where profile.id = frizi_payment_method_refs.profile_id
      and profile.auth_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.frizi_profiles profile
    where profile.id = frizi_payment_method_refs.profile_id
      and profile.auth_user_id = (select auth.uid())
  )
);

grant select, insert, update on public.frizi_salon_waitlist_requests to authenticated;
grant select, insert, update on public.frizi_salon_waitlist_openings to authenticated;
grant select on public.frizi_salon_waitlist_claims to authenticated;
grant select, insert on public.frizi_appointment_policy_acceptances to authenticated;
grant select, insert, update on public.frizi_salon_cancellation_policies to authenticated;
grant select, insert, update on public.frizi_payment_method_refs to authenticated;

comment on table public.frizi_salon_waitlist_requests is
  'Client or Salon-created waitlist demand for a canonical appointment opening. Claiming creates a frizi_appointments row.';

comment on table public.frizi_salon_waitlist_openings is
  'Open capacity created from cancellations. Clients are notified, and first successful claimant wins.';

comment on table public.frizi_payment_method_refs is
  'Tokenized Stripe payment method references only. Raw card data must never be stored.';
