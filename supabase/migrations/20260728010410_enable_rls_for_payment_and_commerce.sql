-- Harden payment, appointment-pricing, and commerce tables in the exposed public schema.
-- Keep operational ledgers closed by default. Public read is limited to approved,
-- searchable storefront catalogue records.

alter table public.payment_records enable row level security;
alter table public.frizi_services enable row level security;
alter table public.frizi_service_price_overrides enable row level security;
alter table public.frizi_promotions enable row level security;
alter table public.frizi_promotion_redemptions enable row level security;
alter table public.frizi_payment_snapshots enable row level security;
alter table public.frizi_deposit_payments enable row level security;

alter table public.frizi_commerce_products enable row level security;
alter table public.frizi_commerce_product_variants enable row level security;
alter table public.frizi_commerce_suppliers enable row level security;
alter table public.frizi_commerce_supplier_listings enable row level security;
alter table public.frizi_commerce_inventory_records enable row level security;
alter table public.frizi_product_recommendations enable row level security;
alter table public.frizi_commerce_carts enable row level security;
alter table public.frizi_commerce_cart_items enable row level security;
alter table public.frizi_commerce_orders enable row level security;
alter table public.frizi_commerce_order_price_snapshots enable row level security;
alter table public.frizi_commerce_order_items enable row level security;
alter table public.frizi_commerce_shipments enable row level security;
alter table public.frizi_commerce_commissions enable row level security;
alter table public.frizi_commerce_commission_adjustments enable row level security;
alter table public.frizi_commerce_returns enable row level security;
alter table public.frizi_product_safety_incidents enable row level security;
alter table public.frizi_product_recalls enable row level security;
alter table public.frizi_commerce_consent_records enable row level security;
alter table public.frizi_commerce_audit_logs enable row level security;

create policy "active public services are readable"
on public.frizi_services
for select
to anon, authenticated
using (active = true);

create policy "active public appointment promotions are readable"
on public.frizi_promotions
for select
to anon, authenticated
using (active = true and (start_at is null or start_at <= now()) and (end_at is null or end_at >= now()));

create policy "approved commerce products are public readable"
on public.frizi_commerce_products
for select
to anon, authenticated
using (
  status = 'active'
  and compliance_state = 'approved_for_canadian_sale'
  and searchable = true
  and discontinued = false
  and recalled = false
);

create policy "approved commerce variants are public readable"
on public.frizi_commerce_product_variants
for select
to anon, authenticated
using (
  active = true
  and compliance_state = 'approved_for_canadian_sale'
  and exists (
    select 1
    from public.frizi_commerce_products
    where frizi_commerce_products.id = frizi_commerce_product_variants.product_id
      and frizi_commerce_products.status = 'active'
      and frizi_commerce_products.compliance_state = 'approved_for_canadian_sale'
      and frizi_commerce_products.searchable = true
      and frizi_commerce_products.discontinued = false
      and frizi_commerce_products.recalled = false
  )
);

create policy "approved storefront supplier listings are public readable"
on public.frizi_commerce_supplier_listings
for select
to anon, authenticated
using (
  active = true
  and exists (
    select 1
    from public.frizi_commerce_suppliers
    where frizi_commerce_suppliers.id = frizi_commerce_supplier_listings.supplier_id
      and frizi_commerce_suppliers.active = true
      and frizi_commerce_suppliers.online_resale_allowed = true
  )
  and exists (
    select 1
    from public.frizi_commerce_product_variants
    join public.frizi_commerce_products
      on frizi_commerce_products.id = frizi_commerce_product_variants.product_id
    where frizi_commerce_product_variants.id = frizi_commerce_supplier_listings.variant_id
      and frizi_commerce_product_variants.active = true
      and frizi_commerce_product_variants.compliance_state = 'approved_for_canadian_sale'
      and frizi_commerce_products.status = 'active'
      and frizi_commerce_products.compliance_state = 'approved_for_canadian_sale'
      and frizi_commerce_products.searchable = true
      and frizi_commerce_products.discontinued = false
      and frizi_commerce_products.recalled = false
  )
);

create policy "visible product recommendations are readable by authenticated users"
on public.frizi_product_recommendations
for select
to authenticated
using (active = true and consent_visibility_status = 'visible_to_customer');
