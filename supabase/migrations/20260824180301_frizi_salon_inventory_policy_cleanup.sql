drop policy if exists "salon front desk can manage inventory items" on public.frizi_salon_inventory_items;
drop policy if exists "salon front desk can create inventory items" on public.frizi_salon_inventory_items;
drop policy if exists "salon front desk can update inventory items" on public.frizi_salon_inventory_items;
drop policy if exists "salon front desk can delete inventory items" on public.frizi_salon_inventory_items;

create policy "salon front desk can create inventory items"
on public.frizi_salon_inventory_items
for insert
to authenticated
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

create policy "salon front desk can update inventory items"
on public.frizi_salon_inventory_items
for update
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

create policy "salon front desk can delete inventory items"
on public.frizi_salon_inventory_items
for delete
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon front desk can manage inventory alerts" on public.frizi_salon_inventory_alerts;
drop policy if exists "salon front desk can create inventory alerts" on public.frizi_salon_inventory_alerts;
drop policy if exists "salon front desk can update inventory alerts" on public.frizi_salon_inventory_alerts;

create policy "salon front desk can create inventory alerts"
on public.frizi_salon_inventory_alerts
for insert
to authenticated
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

create policy "salon front desk can update inventory alerts"
on public.frizi_salon_inventory_alerts
for update
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon managers can manage service recipes" on public.frizi_salon_service_product_recipes;
drop policy if exists "salon managers can create service recipes" on public.frizi_salon_service_product_recipes;
drop policy if exists "salon managers can update service recipes" on public.frizi_salon_service_product_recipes;
drop policy if exists "salon managers can delete service recipes" on public.frizi_salon_service_product_recipes;

create policy "salon managers can create service recipes"
on public.frizi_salon_service_product_recipes
for insert
to authenticated
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager']));

create policy "salon managers can update service recipes"
on public.frizi_salon_service_product_recipes
for update
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager']))
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager']));

create policy "salon managers can delete service recipes"
on public.frizi_salon_service_product_recipes
for delete
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager']));
