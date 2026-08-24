-- Phase E: paid Salon CRM, Hair Profile, and private-note capability guards.
-- Free Salon remains useful for booking contacts and appointment history, while
-- Hair Profiles, Salon-private notes, tags, and relationship segmentation stay
-- behind the canonical paid Salon CRM capability.

create or replace function public.frizi_salon_has_capability(
  target_salon_id uuid,
  capability text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  resolved_plan text;
  normalized_capability text := lower(coalesce(capability, ''));
begin
  if target_salon_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.frizi_salons salon
    where salon.id = target_salon_id
      and salon.status in ('active', 'draft')
  ) then
    return false;
  end if;

  resolved_plan := public.frizi_salon_resolved_plan(target_salon_id);

  if normalized_capability = any (array[
    'canusemanualcalendar',
    'canmanagecalendarstaff',
    'canusebasicappointments',
    'canusebasicwalkins',
    'canusebasicbookingcontacts',
    'canusebasichistory',
    'canusebasicclientdirectory',
    'canusebasicclienthistory',
    'canmanagebasichours',
    'canuseadminalwaysavailable'
  ]) then
    return resolved_plan in ('salon_free', 'salon', 'salon_pro');
  end if;

  if normalized_capability = any (array[
    'canuseconnectedstaffaccounts',
    'canusewebsitebooking',
    'canusesaloncrm',
    'canaccesssalonhairprofiles',
    'canusesalonprivatenotes',
    'canusebasicclienttags',
    'canusemessaging',
    'canusepayments',
    'canusedeposits',
    'canusepromotions',
    'canusereviewsdiscovery',
    'canusegiftcards',
    'canusepackages',
    'canusememberships',
    'canusereports',
    'canusestructuredservices'
  ]) then
    return resolved_plan in ('salon', 'salon_pro');
  end if;

  if normalized_capability = any (array[
    'canuseproducts',
    'canuseinventory',
    'canuseadvancedmarketing',
    'canuseadvancedreporting',
    'canusestaffperformance',
    'canuseadvancedpermissions',
    'canusetimeclock',
    'canusecommissioninputs',
    'canusebusinessoptimization',
    'canusemultilocationadvanced',
    'canuseadvancedclientsegmentation'
  ]) then
    return resolved_plan = 'salon_pro';
  end if;

  return false;
end;
$$;

revoke all on function public.frizi_salon_has_capability(uuid, text) from public;
grant execute on function public.frizi_salon_has_capability(uuid, text) to authenticated;

drop policy if exists "salon members can read salon booking clients" on public.frizi_clients;
create policy "salon members can read salon booking clients"
on public.frizi_clients
for select
to authenticated
using (
  (
    created_by_salon_id is not null
    and public.frizi_is_salon_member(created_by_salon_id, array['owner', 'manager', 'reception'])
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
  or exists (
    select 1
    from public.frizi_salon_client_relationships salon_rel
    where salon_rel.client_id = frizi_clients.id
      and salon_rel.relationship_status <> 'archived'
      and (
        (
          public.frizi_salon_has_capability(salon_rel.salon_id, 'canUseSalonCRM')
          and public.frizi_is_salon_member(salon_rel.salon_id, array['owner', 'manager', 'reception'])
        )
        or public.frizi_salon_staff_can_view_client(salon_rel.salon_id, salon_rel.client_id)
      )
  )
);

drop policy if exists "salon managers can read salon client records" on public.frizi_salon_client_relationships;
create policy "salon managers can read salon client records"
on public.frizi_salon_client_relationships
for select
to authenticated
using (
  public.frizi_salon_has_capability(salon_id, 'canUseSalonCRM')
  and (
    public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
    or public.frizi_salon_staff_can_view_client(salon_id, client_id)
  )
);

drop policy if exists "salon managers can create salon client records" on public.frizi_salon_client_relationships;
create policy "salon managers can create salon client records"
on public.frizi_salon_client_relationships
for insert
to authenticated
with check (
  public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
  and (
    public.frizi_salon_has_capability(salon_id, 'canUseSalonCRM')
    or (
      tags = '{}'::text[]
      and private_salon_notes is null
      and marketing_consent_status = 'unknown'
      and relationship_status in ('active', 'prospect')
      and source in ('manual', 'walk_in', 'phone_booking', 'website_booking', 'booking')
    )
  )
);

drop policy if exists "salon managers can update salon client records" on public.frizi_salon_client_relationships;
create policy "salon managers can update salon client records"
on public.frizi_salon_client_relationships
for update
to authenticated
using (
  public.frizi_salon_has_capability(salon_id, 'canUseSalonCRM')
  and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
)
with check (
  public.frizi_salon_has_capability(salon_id, 'canUseSalonCRM')
  and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
);

drop policy if exists "salon users can read scoped salon client notes" on public.frizi_salon_client_notes;
create policy "salon users can read scoped salon client notes"
on public.frizi_salon_client_notes
for select
to authenticated
using (
  public.frizi_salon_has_capability(salon_id, 'canUseSalonPrivateNotes')
  and (
    public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
    or (
      visibility in ('staff_limited', 'client_visible_hair_profile')
      and public.frizi_salon_staff_can_view_client(salon_id, client_id)
    )
  )
);

drop policy if exists "salon managers can create salon client notes" on public.frizi_salon_client_notes;
create policy "salon managers can create salon client notes"
on public.frizi_salon_client_notes
for insert
to authenticated
with check (
  public.frizi_salon_has_capability(salon_id, 'canUseSalonPrivateNotes')
  and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
);

drop policy if exists "salon managers can update salon client notes" on public.frizi_salon_client_notes;
create policy "salon managers can update salon client notes"
on public.frizi_salon_client_notes
for update
to authenticated
using (
  public.frizi_salon_has_capability(salon_id, 'canUseSalonPrivateNotes')
  and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
)
with check (
  public.frizi_salon_has_capability(salon_id, 'canUseSalonPrivateNotes')
  and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception'])
);

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
      and public.frizi_salon_has_capability(salon_rel.salon_id, 'canAccessSalonHairProfiles')
      and public.frizi_is_salon_member(salon_rel.salon_id, array['owner', 'manager', 'reception'])
  )
)
with check (
  exists (
    select 1
    from public.frizi_salon_client_relationships salon_rel
    where salon_rel.client_id = frizi_clients.id
      and salon_rel.relationship_status <> 'archived'
      and public.frizi_salon_has_capability(salon_rel.salon_id, 'canAccessSalonHairProfiles')
      and public.frizi_is_salon_member(salon_rel.salon_id, array['owner', 'manager', 'reception'])
  )
);

comment on function public.frizi_salon_has_capability(uuid, text) is
  'Canonical server-side Salon capability resolver. Phase E keeps basic booking contacts free and gates Salon CRM, Hair Profiles, notes, and segmentation to paid tiers.';
