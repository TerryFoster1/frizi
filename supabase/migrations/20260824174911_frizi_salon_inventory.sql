create table if not exists public.frizi_salon_inventory_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  location_id uuid references public.frizi_salon_locations(id) on delete cascade,
  product_id text references public.frizi_commerce_products(id) on delete set null,
  variant_id text references public.frizi_commerce_product_variants(id) on delete set null,
  sku text,
  item_name text not null,
  inventory_kind text not null default 'retail'
    check (inventory_kind in ('retail', 'backbar')),
  supplier_name text,
  supplier_sku text,
  marketplace_source text not null default 'none'
    check (marketplace_source in ('none', 'frizi_marketplace', 'external_supplier')),
  frizi_marketplace_available boolean not null default false,
  unit_label text not null default 'each',
  on_hand_quantity numeric(12, 2) not null default 0,
  par_level numeric(12, 2) not null default 0 check (par_level >= 0),
  reorder_point numeric(12, 2) not null default 0 check (reorder_point >= 0),
  cost_cents integer not null default 0 check (cost_cents >= 0),
  retail_price_cents integer not null default 0 check (retail_price_cents >= 0),
  currency text not null default 'cad',
  allow_negative_stock boolean not null default false,
  active boolean not null default true,
  created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (allow_negative_stock or on_hand_quantity >= 0)
);

create table if not exists public.frizi_salon_inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  location_id uuid references public.frizi_salon_locations(id) on delete set null,
  inventory_item_id uuid not null references public.frizi_salon_inventory_items(id) on delete cascade,
  adjustment_type text not null
    check (adjustment_type in ('received', 'damaged', 'used', 'lost', 'sale', 'correction', 'return')),
  quantity_delta numeric(12, 2) not null check (quantity_delta <> 0),
  quantity_after numeric(12, 2) not null,
  reason text,
  order_id uuid references public.frizi_salon_orders(id) on delete set null,
  order_item_id uuid references public.frizi_salon_order_items(id) on delete set null,
  appointment_id uuid references public.frizi_appointments(id) on delete set null,
  created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.frizi_salon_inventory_alerts (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  location_id uuid references public.frizi_salon_locations(id) on delete cascade,
  inventory_item_id uuid not null references public.frizi_salon_inventory_items(id) on delete cascade,
  alert_type text not null check (alert_type in ('below_reorder_point', 'below_par', 'negative_stock_blocked')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  current_quantity numeric(12, 2) not null default 0,
  threshold_quantity numeric(12, 2) not null default 0,
  suggested_reorder_quantity numeric(12, 2) not null default 0,
  acknowledged_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_salon_service_product_recipes (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  service_id text not null references public.frizi_services(id) on delete cascade,
  inventory_item_id uuid not null references public.frizi_salon_inventory_items(id) on delete cascade,
  quantity_per_service numeric(12, 2) not null check (quantity_per_service > 0),
  unit_label text not null default 'each',
  active boolean not null default true,
  notes text,
  created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists frizi_salon_inventory_items_salon_location_idx
  on public.frizi_salon_inventory_items (salon_id, location_id, inventory_kind, active);

create unique index if not exists frizi_salon_inventory_items_variant_unique_idx
  on public.frizi_salon_inventory_items (salon_id, location_id, variant_id)
  where variant_id is not null;

create unique index if not exists frizi_salon_inventory_items_manual_sku_unique_idx
  on public.frizi_salon_inventory_items (salon_id, location_id, lower(sku))
  where variant_id is null and sku is not null;

create index if not exists frizi_salon_inventory_adjustments_item_idx
  on public.frizi_salon_inventory_adjustments (inventory_item_id, created_at desc);

create index if not exists frizi_salon_inventory_alerts_salon_status_idx
  on public.frizi_salon_inventory_alerts (salon_id, status, alert_type, created_at desc);

create index if not exists frizi_salon_service_product_recipes_service_idx
  on public.frizi_salon_service_product_recipes (salon_id, service_id, active);

create or replace function public.frizi_refresh_salon_inventory_alerts(target_inventory_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.frizi_salon_inventory_items%rowtype;
  suggested_reorder numeric(12, 2);
  has_access boolean;
begin
  select * into item
  from public.frizi_salon_inventory_items
  where id = target_inventory_item_id;

  if not found then
    return;
  end if;

  has_access := current_user = 'service_role'
    or public.frizi_is_salon_member(item.salon_id, array['owner', 'manager', 'reception']);

  if not has_access then
    raise exception 'You do not have permission to manage this salon inventory item.';
  end if;

  suggested_reorder := greatest(item.par_level - item.on_hand_quantity, 0);

  if item.on_hand_quantity < item.reorder_point then
    update public.frizi_salon_inventory_alerts
    set
      current_quantity = item.on_hand_quantity,
      threshold_quantity = item.reorder_point,
      suggested_reorder_quantity = suggested_reorder,
      updated_at = now()
    where inventory_item_id = item.id
      and alert_type = 'below_reorder_point'
      and status = 'open';

    if not found then
      insert into public.frizi_salon_inventory_alerts (
        salon_id,
        location_id,
        inventory_item_id,
        alert_type,
        current_quantity,
        threshold_quantity,
        suggested_reorder_quantity
      )
      values (
        item.salon_id,
        item.location_id,
        item.id,
        'below_reorder_point',
        item.on_hand_quantity,
        item.reorder_point,
        suggested_reorder
      );
    end if;
  else
    update public.frizi_salon_inventory_alerts
    set status = 'resolved', resolved_at = now(), updated_at = now()
    where inventory_item_id = item.id
      and alert_type = 'below_reorder_point'
      and status = 'open';
  end if;

  if item.on_hand_quantity < item.par_level then
    update public.frizi_salon_inventory_alerts
    set
      current_quantity = item.on_hand_quantity,
      threshold_quantity = item.par_level,
      suggested_reorder_quantity = suggested_reorder,
      updated_at = now()
    where inventory_item_id = item.id
      and alert_type = 'below_par'
      and status = 'open';

    if not found then
      insert into public.frizi_salon_inventory_alerts (
        salon_id,
        location_id,
        inventory_item_id,
        alert_type,
        current_quantity,
        threshold_quantity,
        suggested_reorder_quantity
      )
      values (
        item.salon_id,
        item.location_id,
        item.id,
        'below_par',
        item.on_hand_quantity,
        item.par_level,
        suggested_reorder
      );
    end if;
  else
    update public.frizi_salon_inventory_alerts
    set status = 'resolved', resolved_at = now(), updated_at = now()
    where inventory_item_id = item.id
      and alert_type = 'below_par'
      and status = 'open';
  end if;
end;
$$;

create or replace function public.frizi_record_salon_inventory_adjustment(
  target_inventory_item_id uuid,
  adjustment_kind text,
  quantity_delta numeric,
  adjustment_reason text default null,
  source_order_id uuid default null,
  source_order_item_id uuid default null,
  source_appointment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.frizi_salon_inventory_items%rowtype;
  next_quantity numeric(12, 2);
  profile_id uuid;
  adjustment_id uuid;
  has_access boolean;
begin
  if adjustment_kind not in ('received', 'damaged', 'used', 'lost', 'sale', 'correction', 'return') then
    raise exception 'Choose a valid stock adjustment type.';
  end if;

  if quantity_delta = 0 then
    raise exception 'Enter a stock adjustment quantity.';
  end if;

  select * into item
  from public.frizi_salon_inventory_items
  where id = target_inventory_item_id
  for update;

  if not found then
    raise exception 'Inventory item could not be found.';
  end if;

  has_access := current_user = 'service_role'
    or public.frizi_is_salon_member(item.salon_id, array['owner', 'manager', 'reception']);

  if not has_access then
    raise exception 'You do not have permission to manage this salon inventory item.';
  end if;

  next_quantity := item.on_hand_quantity + quantity_delta;

  if next_quantity < 0 and not item.allow_negative_stock then
    update public.frizi_salon_inventory_alerts
    set
      current_quantity = item.on_hand_quantity,
      threshold_quantity = 0,
      suggested_reorder_quantity = greatest(item.par_level - item.on_hand_quantity, 0),
      updated_at = now()
    where inventory_item_id = item.id
      and alert_type = 'negative_stock_blocked'
      and status = 'open';

    if not found then
      insert into public.frizi_salon_inventory_alerts (
        salon_id,
        location_id,
        inventory_item_id,
        alert_type,
        current_quantity,
        threshold_quantity,
        suggested_reorder_quantity
      )
      values (
        item.salon_id,
        item.location_id,
        item.id,
        'negative_stock_blocked',
        item.on_hand_quantity,
        0,
        greatest(item.par_level - item.on_hand_quantity, 0)
      );
    end if;

    raise exception 'This adjustment would make stock negative.';
  end if;

  select public.frizi_current_profile_id() into profile_id;

  update public.frizi_salon_inventory_items
  set on_hand_quantity = next_quantity, updated_at = now()
  where id = item.id;

  insert into public.frizi_salon_inventory_adjustments (
    salon_id,
    location_id,
    inventory_item_id,
    adjustment_type,
    quantity_delta,
    quantity_after,
    reason,
    order_id,
    order_item_id,
    appointment_id,
    created_by_profile_id
  )
  values (
    item.salon_id,
    item.location_id,
    item.id,
    adjustment_kind,
    quantity_delta,
    next_quantity,
    adjustment_reason,
    source_order_id,
    source_order_item_id,
    source_appointment_id,
    profile_id
  )
  returning id into adjustment_id;

  perform public.frizi_refresh_salon_inventory_alerts(item.id);

  return adjustment_id;
end;
$$;

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
      and product_variant_id is not null
  loop
    select * into inventory_item
    from public.frizi_salon_inventory_items
    where salon_id = salon_order.salon_id
      and (location_id is not distinct from salon_order.salon_location_id)
      and variant_id = line_item.product_variant_id
      and inventory_kind = 'retail'
      and active = true
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

revoke all on function public.frizi_refresh_salon_inventory_alerts(uuid) from public;
revoke all on function public.frizi_record_salon_inventory_adjustment(uuid, text, numeric, text, uuid, uuid, uuid) from public;
revoke all on function public.frizi_deduct_salon_inventory_for_order(uuid) from public;
grant execute on function public.frizi_refresh_salon_inventory_alerts(uuid) to authenticated, service_role;
grant execute on function public.frizi_record_salon_inventory_adjustment(uuid, text, numeric, text, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.frizi_deduct_salon_inventory_for_order(uuid) to authenticated, service_role;

alter table public.frizi_salon_inventory_items enable row level security;
alter table public.frizi_salon_inventory_adjustments enable row level security;
alter table public.frizi_salon_inventory_alerts enable row level security;
alter table public.frizi_salon_service_product_recipes enable row level security;

drop policy if exists "salon members can read inventory items" on public.frizi_salon_inventory_items;
create policy "salon members can read inventory items"
on public.frizi_salon_inventory_items
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "salon front desk can manage inventory items" on public.frizi_salon_inventory_items;
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

drop policy if exists "salon members can read inventory adjustments" on public.frizi_salon_inventory_adjustments;
create policy "salon members can read inventory adjustments"
on public.frizi_salon_inventory_adjustments
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "salon front desk can create inventory adjustments" on public.frizi_salon_inventory_adjustments;
create policy "salon front desk can create inventory adjustments"
on public.frizi_salon_inventory_adjustments
for insert
to authenticated
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon members can read inventory alerts" on public.frizi_salon_inventory_alerts;
create policy "salon members can read inventory alerts"
on public.frizi_salon_inventory_alerts
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "salon front desk can manage inventory alerts" on public.frizi_salon_inventory_alerts;
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

drop policy if exists "salon members can read service recipes" on public.frizi_salon_service_product_recipes;
create policy "salon members can read service recipes"
on public.frizi_salon_service_product_recipes
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "salon managers can manage service recipes" on public.frizi_salon_service_product_recipes;
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

grant select, insert, update on public.frizi_salon_inventory_items to authenticated;
grant select, insert on public.frizi_salon_inventory_adjustments to authenticated;
grant select, insert, update on public.frizi_salon_inventory_alerts to authenticated;
grant select, insert, update on public.frizi_salon_service_product_recipes to authenticated;

comment on table public.frizi_salon_inventory_items is
  'Salon-scoped retail and backbar inventory linked to canonical Frizi commerce products/variants when available.';
comment on table public.frizi_salon_inventory_adjustments is
  'Inventory audit trail for received, damaged, used, lost, sale, return, and count correction events.';
comment on table public.frizi_salon_inventory_alerts is
  'Low-stock and blocked-negative-stock alerts generated from Salon inventory levels.';
comment on table public.frizi_salon_service_product_recipes is
  'Future foundation for service recipes, such as colour services consuming measured backbar products.';
comment on column public.frizi_salon_inventory_items.marketplace_source is
  'Marketplace hook only. Do not create fake supplier availability; Frizi Marketplace availability must be explicit.';
