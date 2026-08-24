-- Allow Salon managers/reception to see booking clients and maintain the same
-- canonical client-professional relationship used by Pro and Client.

drop policy if exists "salon members can read salon booking clients" on public.frizi_clients;
create policy "salon members can read salon booking clients"
on public.frizi_clients
for select
to authenticated
using (
  exists (
    select 1
    from public.frizi_appointments appointment
    where appointment.client_id = frizi_clients.id
      and appointment.salon_id is not null
      and public.frizi_is_salon_member(appointment.salon_id)
  )
  or exists (
    select 1
    from public.frizi_client_professional_relationships rel
    join public.frizi_salon_staff_assignments assignment
      on assignment.professional_id = rel.professional_id
    where rel.client_id = frizi_clients.id
      and assignment.employment_status = 'active'
      and public.frizi_is_salon_member(assignment.salon_id)
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
      and public.frizi_is_salon_member(assignment.salon_id)
  )
);

drop policy if exists "salon members can create salon CRM relationships" on public.frizi_client_professional_relationships;
create policy "salon members can create salon CRM relationships"
on public.frizi_client_professional_relationships
for insert
to authenticated
with check (
  exists (
    select 1
    from public.frizi_salon_staff_assignments assignment
    where assignment.professional_id = frizi_client_professional_relationships.professional_id
      and assignment.employment_status = 'active'
      and public.frizi_is_salon_member(assignment.salon_id, array['owner', 'manager', 'reception'])
  )
);

drop policy if exists "salon members can update salon CRM relationships" on public.frizi_client_professional_relationships;
create policy "salon members can update salon CRM relationships"
on public.frizi_client_professional_relationships
for update
to authenticated
using (
  exists (
    select 1
    from public.frizi_salon_staff_assignments assignment
    where assignment.professional_id = frizi_client_professional_relationships.professional_id
      and assignment.employment_status = 'active'
      and public.frizi_is_salon_member(assignment.salon_id, array['owner', 'manager', 'reception'])
  )
)
with check (
  exists (
    select 1
    from public.frizi_salon_staff_assignments assignment
    where assignment.professional_id = frizi_client_professional_relationships.professional_id
      and assignment.employment_status = 'active'
      and public.frizi_is_salon_member(assignment.salon_id, array['owner', 'manager', 'reception'])
  )
);

grant select, insert, update on public.frizi_client_professional_relationships to authenticated;
