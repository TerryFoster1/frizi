-- Avoid broad FOR ALL policy expansion on professional locations. Command-
-- specific policies preserve the same ownership rule while keeping UPDATE and
-- DELETE checks independent from public discovery reads.

drop policy if exists "professionals can manage own locations" on public.frizi_professional_locations;

create policy "professionals can read own locations"
on public.frizi_professional_locations
for select
to authenticated
using (public.frizi_is_current_professional(professional_id));

create policy "professionals can create own locations"
on public.frizi_professional_locations
for insert
to authenticated
with check (public.frizi_is_current_professional(professional_id));

create policy "professionals can update own locations"
on public.frizi_professional_locations
for update
to authenticated
using (public.frizi_is_current_professional(professional_id))
with check (public.frizi_is_current_professional(professional_id));

create policy "professionals can delete own locations"
on public.frizi_professional_locations
for delete
to authenticated
using (public.frizi_is_current_professional(professional_id));
