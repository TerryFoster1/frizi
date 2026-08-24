alter table public.frizi_salon_order_items
  add column if not exists salon_inventory_item_id uuid references public.frizi_salon_inventory_items(id) on delete set null;

create index if not exists frizi_salon_order_items_inventory_item_idx
  on public.frizi_salon_order_items (salon_inventory_item_id)
  where salon_inventory_item_id is not null;

create or replace function public.frizi_deduct_salon_inventory_for_order(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  salon_order public.frizi_salon_orders%rowtype;
  line_item record;
  inventory_item public.frizi_salon_inventory_items%rowtype;
  has_access boolean;
begin
  select * into salon_order
  from public.frizi_salon_orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Salon order could not be found.';
  end if;

  if salon_order.merchant_context <> 'salon' then
    raise exception 'Only salon-context orders can deduct salon inventory.';
  end if;

  has_access := current_user = 'service_role'
    or public.frizi_is_salon_member(salon_order.salon_id, array['owner', 'manager', 'reception']);

  if not has_access then
    raise exception 'You do not have permission to manage this salon order.';
  end if;

  for line_item in
    select *
    from public.frizi_salon_order_items
    where order_id = target_order_id
      and item_type = 'product'
      and (salon_inventory_item_id is not null or product_variant_id is not null)
  loop
    select * into inventory_item
    from public.frizi_salon_inventory_items
    where salon_id = salon_order.salon_id
      and active = true
      and (
        id = line_item.salon_inventory_item_id
        or (
          line_item.salon_inventory_item_id is null
          and location_id is not distinct from salon_order.salon_location_id
          and variant_id = line_item.product_variant_id
        )
      )
    order by case when id = line_item.salon_inventory_item_id then 0 else 1 end
    limit 1
    for update;

    if found then
      perform public.frizi_record_salon_inventory_adjustment(
        inventory_item.id,
        'sale',
        -1 * line_item.quantity,
        'Product sale deducted from Salon checkout.',
        salon_order.id,
        line_item.id,
        salon_order.appointment_id
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.frizi_deduct_salon_inventory_for_order(uuid) from public;
grant execute on function public.frizi_deduct_salon_inventory_for_order(uuid) to authenticated, service_role;

comment on column public.frizi_salon_order_items.salon_inventory_item_id is
  'Optional direct pointer to the Salon inventory item to deduct when a product checkout is paid.';
