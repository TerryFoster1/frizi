-- Phase 4: Salon CRM and Hair Profile access without duplicating Client identity.

create table if not exists public.frizi_salon_client_relationships (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  client_id uuid not null references public.frizi_clients(id) on delete cascade,
  relationship_status text not null default 'active'
    check (relationship_status in ('active', 'prospect', 'lapsed', 'blocked', 'archived')),
  source text not null default 'manual'
    check (source in ('manual', 'walk_in', 'phone_booking', 'website_booking', 'invite', 'booking', 'import')),
  tags text[] not null default '{}'::text[],
  private_salon_notes text,
  preferred_professional_id uuid references public.frizi_professionals(id) on delete set null,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  next_visit_at timestamptz,
  total_spend_cents integer not null default 0 check (total_spend_cents >= 0),
  created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, client_id)
);

create table if not exists public.frizi_salon_client_notes (
  id uuid primary key default gen_random_uuid(),
  salon_relationship_id uuid not null references public.frizi_salon_client_relationships(id) on delete cascade,
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  client_id uuid not null references public.frizi_clients(id) on delete cascade,
  appointment_id uuid references public.frizi_appointments(id) on delete set null,
  note_type text not null default 'general',
  visibility text not null default 'salon_private'
    check (visibility in ('salon_private', 'staff_limited', 'client_visible_hair_profile')),
  body text not null,
  created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.frizi_salon_client_relationships enable row level security;
alter table public.frizi_salon_client_notes enable row level security;

create index if not exists frizi_salon_client_relationships_salon_status_idx
  on public.frizi_salon_client_relationships (salon_id, relationship_status, updated_at desc);

create index if not exists frizi_salon_client_relationships_client_idx
  on public.frizi_salon_client_relationships (client_id, salon_id);

create index if not exists frizi_salon_client_notes_relationship_idx
  on public.frizi_salon_client_notes (salon_relationship_id, created_at desc);

create or replace function public.frizi_salon_staff_can_view_client(target_salon_id uuid, target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.frizi_appointments appointment
    where appointment.salon_id = target_salon_id
      and appointment.client_id = target_client_id
      and appointment.salon_staff_assignment_id is not null
      and public.frizi_is_current_salon_staff_assignment(appointment.salon_staff_assignment_id)
      and appointment.status in ('pending', 'confirmed', 'requested', 'completed')
  )
$$;

drop policy if exists "salon members can read salon booking clients" on public.frizi_clients;
create policy "salon members can read salon booking clients"
on public.frizi_clients
for select
to authenticated
using (
  exists (
    select 1
    from public.frizi_salon_client_relationships salon_rel
    where salon_rel.client_id = frizi_clients.id
      and salon_rel.relationship_status <> 'archived'
      and (
        public.frizi_is_salon_member(salon_rel.salon_id, array['owner', 'manager', 'reception'])
        or public.frizi_salon_staff_can_view_client(salon_rel.salon_id, salon_rel.client_id)
      )
  )
  or exists (
    select 1
    from public.frizi_appointments appointment
    where appointment.client_id = frizi_clients.id
      and appointment.salon_id is not null
      and (
        public.frizi_is_salon_member(appointment.salon_id, array['owner', 'manager', 'reception'])
        or (
          appointment.salon_staff_assignment_id is not null
          and public.frizi_is_current_salon_staff_assignment(appointment.salon_staff_assignment_id)
        )
      )
  )
);

drop policy if exists "salon members can read salon CRM relationships" on public.frizi_client_professional_relationships;
create policy "salon members can read salon CRM relationships"
on public.frizi_client_professional_relationships
for select
to authenticated
using (
  exists (
    select 1
    from public.frizi_salon_staff_assignments assignment
    where assignment.professional_id = frizi_client_professional_relationships.professional_id
      and assignment.employment_status = 'active'
      and (
        public.frizi_is_salon_member(assignment.salon_id, array['owner', 'manager', 'reception'])
        or public.frizi_salon_staff_can_view_client(assignment.salon_id, frizi_client_professional_relationships.client_id)
      )
  )
);

drop policy if exists "salon managers can read salon client records" on public.frizi_salon_client_relationships;
create policy "salon managers can read salon client records"
on public.frizi_salon_client_relationships
for select
to authenticated
using (
  public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
  or public.frizi_salon_staff_can_view_client(salon_id, client_id)
);

drop policy if exists "salon managers can create salon client records" on public.frizi_salon_client_relationships;
create policy "salon managers can create salon client records"
on public.frizi_salon_client_relationships
for insert
to authenticated
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon managers can update salon client records" on public.frizi_salon_client_relationships;
create policy "salon managers can update salon client records"
on public.frizi_salon_client_relationships
for update
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon users can read scoped salon client notes" on public.frizi_salon_client_notes;
create policy "salon users can read scoped salon client notes"
on public.frizi_salon_client_notes
for select
to authenticated
using (
  public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
  or (
    visibility in ('staff_limited', 'client_visible_hair_profile')
    and public.frizi_salon_staff_can_view_client(salon_id, client_id)
  )
);

drop policy if exists "salon managers can create salon client notes" on public.frizi_salon_client_notes;
create policy "salon managers can create salon client notes"
on public.frizi_salon_client_notes
for insert
to authenticated
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon managers can update salon client notes" on public.frizi_salon_client_notes;
create policy "salon managers can update salon client notes"
on public.frizi_salon_client_notes
for update
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon managers can update client hair profiles" on public.frizi_clients;
create policy "salon managers can update client hair profiles"
on public.frizi_clients
for update
to authenticated
using (
  exists (
    select 1
    from public.frizi_salon_client_relationships salon_rel
    where salon_rel.client_id = frizi_clients.id
      and salon_rel.relationship_status <> 'archived'
      and public.frizi_is_salon_member(salon_rel.salon_id, array['owner', 'manager', 'reception'])
  )
)
with check (
  exists (
    select 1
    from public.frizi_salon_client_relationships salon_rel
    where salon_rel.client_id = frizi_clients.id
      and salon_rel.relationship_status <> 'archived'
      and public.frizi_is_salon_member(salon_rel.salon_id, array['owner', 'manager', 'reception'])
  )
);

insert into public.frizi_salon_client_relationships (
  salon_id,
  client_id,
  relationship_status,
  source,
  preferred_professional_id,
  first_visit_at,
  last_visit_at,
  next_visit_at
)
select
  appointment.salon_id,
  appointment.client_id,
  'active',
  case when appointment.booking_source = 'salon_app' then 'booking' else 'website_booking' end,
  appointment.professional_id,
  min(appointment.starts_at),
  max(case when appointment.starts_at <= now() then appointment.starts_at end),
  min(case when appointment.starts_at > now() then appointment.starts_at end)
from public.frizi_appointments appointment
where appointment.salon_id is not null
group by appointment.salon_id, appointment.client_id, appointment.professional_id, appointment.booking_source
on conflict (salon_id, client_id) do update
set
  relationship_status = 'active',
  preferred_professional_id = coalesce(excluded.preferred_professional_id, frizi_salon_client_relationships.preferred_professional_id),
  first_visit_at = least(frizi_salon_client_relationships.first_visit_at, excluded.first_visit_at),
  last_visit_at = greatest(frizi_salon_client_relationships.last_visit_at, excluded.last_visit_at),
  next_visit_at = coalesce(least(frizi_salon_client_relationships.next_visit_at, excluded.next_visit_at), frizi_salon_client_relationships.next_visit_at, excluded.next_visit_at),
  updated_at = now();

grant select, insert, update on public.frizi_salon_client_relationships to authenticated;
grant select, insert, update on public.frizi_salon_client_notes to authenticated;
grant execute on function public.frizi_salon_staff_can_view_client(uuid, uuid) to authenticated;

comment on table public.frizi_salon_client_relationships is
  'Salon-scoped CRM relationship linking a salon to canonical Frizi client identity.';

comment on table public.frizi_salon_client_notes is
  'Salon CRM notes with privacy boundaries separate from client-visible hair profile and Pro-private CRM notes.';
