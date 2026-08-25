-- Phase F: Free Salon basic client directory must not expose Hair Profile data.
-- Free Salon uses this RPC for booking contacts/history. It returns only the
-- basic operational fields needed by the Free UI and keeps full CRM/Hair
-- Profile fields behind paid Salon CRM table policies.

create or replace function public.frizi_get_salon_basic_booking_clients(target_salon_id uuid)
returns table (
  client_id uuid,
  preferred_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  source text,
  preferred_professional_id uuid,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  next_visit_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with authorized as (
    select
      target_salon_id as salon_id,
      public.frizi_salon_has_capability(target_salon_id, 'canUseBasicClientDirectory')
        and public.frizi_is_salon_member(target_salon_id, array['owner', 'manager', 'reception']) as allowed
  ),
  created_clients as (
    select
      client.id as client_id,
      client.preferred_name,
      client.first_name,
      client.last_name,
      client.email,
      client.phone,
      'manual'::text as source,
      null::uuid as preferred_professional_id,
      null::timestamptz as first_visit_at,
      null::timestamptz as last_visit_at,
      null::timestamptz as next_visit_at
    from public.frizi_clients client
    join authorized on authorized.allowed
    where client.created_by_salon_id = authorized.salon_id
      and client.profile_id is null
  ),
  appointment_clients as (
    select
      client.id as client_id,
      client.preferred_name,
      client.first_name,
      client.last_name,
      client.email,
      client.phone,
      'booking'::text as source,
      (max(appointment.professional_id::text) filter (where appointment.professional_id is not null))::uuid as preferred_professional_id,
      min(appointment.starts_at) as first_visit_at,
      max(appointment.starts_at) filter (where appointment.starts_at <= now()) as last_visit_at,
      min(appointment.starts_at) filter (where appointment.starts_at > now()) as next_visit_at
    from public.frizi_appointments appointment
    join authorized on authorized.allowed and appointment.salon_id = authorized.salon_id
    join public.frizi_clients client on client.id = appointment.client_id
    group by
      client.id,
      client.preferred_name,
      client.first_name,
      client.last_name,
      client.email,
      client.phone
  )
  select
    combined.client_id,
    max(combined.preferred_name) as preferred_name,
    max(combined.first_name) as first_name,
    max(combined.last_name) as last_name,
    max(combined.email) as email,
    max(combined.phone) as phone,
    case when bool_or(combined.source = 'booking') then 'booking' else 'manual' end as source,
    (max(combined.preferred_professional_id::text) filter (where combined.preferred_professional_id is not null))::uuid as preferred_professional_id,
    min(combined.first_visit_at) as first_visit_at,
    max(combined.last_visit_at) as last_visit_at,
    min(combined.next_visit_at) as next_visit_at
  from (
    select * from created_clients
    union all
    select * from appointment_clients
  ) combined
  group by combined.client_id
  order by coalesce(max(combined.preferred_name), max(combined.first_name), max(combined.email), '') asc;
$$;

revoke all on function public.frizi_get_salon_basic_booking_clients(uuid) from public;
grant execute on function public.frizi_get_salon_basic_booking_clients(uuid) to authenticated;

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
      and public.frizi_salon_has_capability(salon_rel.salon_id, 'canUseSalonCRM')
      and public.frizi_is_salon_member(salon_rel.salon_id, array['owner', 'manager', 'reception'])
  )
);

comment on function public.frizi_get_salon_basic_booking_clients(uuid) is
  'Returns Free/Paid Salon-safe basic booking contact fields without exposing canonical Hair Profile or private client settings.';
