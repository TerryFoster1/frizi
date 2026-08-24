drop policy if exists "salon members can read staff services" on public.frizi_services;
create policy "salon members can read staff services"
on public.frizi_services
for select
to authenticated
using (
  exists (
    select 1
    from public.frizi_salon_staff_assignments assignment
    where assignment.professional_id::text = frizi_services.professional_id
      and assignment.employment_status = 'active'
      and public.frizi_is_salon_member(assignment.salon_id)
  )
);

grant select on public.frizi_services to authenticated;
