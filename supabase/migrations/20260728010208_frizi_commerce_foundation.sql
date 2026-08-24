-- Frizi Commerce foundation.
-- This creates the Canadian-first catalogue, cart, order, fulfilment, commission,
-- return, safety, recall, consent, and audit records required before live commerce.

create table if not exists public.frizi_commerce_products (
  id text primary key,
  status text not null default 'draft',
  product_type text not null,
  regulatory_classification text not null default 'unknown_unreviewed',
  compliance_state text not null default 'draft',
  brand_id text,
  brand_name text not null,
  product_name text not null,
  subtitle text,
  description text,
  usage_instructions text,
  warnings text,
  hair_types text[] not null default '{}',
  hair_concerns text[] not null default '{}',
  service_categories text[] not null default '{}',
  product_categories text[] not null default '{}',
  ingredients text,
  ingredient_source text,
  ingredient_last_verified_at timestamptz,
  ingredient_review_status text not null default 'awaiting_review',
  claims_review_status text not null default 'awaiting_review',
  country_of_manufacture text,
  country_of_origin text,
  canadian_market_version boolean not null default false,
  canadian_authorized_distribution boolean not null default false,
  bilingual_label_confirmed boolean not null default false,
  english_label_text text,
  french_label_text text,
  upc text,
  ean text,
  manufacturer_part_number text,
  internal_frizi_sku text unique,
  variant_group_id text,
  parent_product_id text references public.frizi_commerce_products(id),
  images jsonb not null default '[]'::jsonb,
  primary_image text,
  safety_documents jsonb not null default '[]'::jsonb,
  supplier_documents jsonb not null default '[]'::jsonb,
  product_page_status text not null default 'draft',
  searchable boolean not null default false,
  purchasable boolean not null default false,
  recommendation_only boolean not null default true,
  discontinued boolean not null default false,
  recalled boolean not null default false,
  seller_identity text not null default 'Frizi Commerce Canada',
  compliance_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_compliance_review_at timestamptz,
  compliance_reviewed_by text
);

create table if not exists public.frizi_commerce_product_variants (
  id text primary key,
  product_id text not null references public.frizi_commerce_products(id),
  variant_name text not null,
  sku text not null unique,
  barcode text,
  upc text,
  ean text,
  size_value numeric,
  size_unit text,
  net_quantity_display text,
  shade text,
  scent text,
  weight_grams integer not null,
  dimensions_cm jsonb not null default '{}'::jsonb,
  price_cents integer not null check (price_cents >= 0),
  compare_at_price_cents integer,
  cost_cents integer,
  currency text not null default 'cad',
  inventory_mode text not null default 'manual_purchase',
  inventory_policy text not null default 'reserve_on_checkout',
  compliance_state text not null default 'draft',
  shipping_restrictions text[] not null default '{}',
  return_policy_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_suppliers (
  id text primary key,
  legal_name text not null,
  contact_information jsonb not null default '{}'::jsonb,
  account_number text,
  wholesale_authorization_status text not null default 'awaiting_review',
  brand_authorization_evidence jsonb not null default '[]'::jsonb,
  canadian_distribution_status text not null default 'awaiting_review',
  terms text,
  map_pricing_restrictions text,
  territory_restrictions text,
  online_resale_allowed boolean not null default false,
  marketplace_restrictions text,
  dropship_permissions text,
  image_trademark_permissions text,
  return_terms text,
  recall_contact text,
  active boolean not null default false,
  last_reviewed_at timestamptz,
  compliance_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_supplier_listings (
  id text primary key,
  product_id text not null references public.frizi_commerce_products(id),
  variant_id text not null references public.frizi_commerce_product_variants(id),
  supplier_id text not null references public.frizi_commerce_suppliers(id),
  supplier_product_id text,
  supplier_sku text not null,
  supplier_product_name text,
  wholesale_cost_cents integer not null check (wholesale_cost_cents >= 0),
  currency text not null default 'cad',
  case_pack_quantity integer,
  minimum_order_quantity integer,
  available_inventory integer,
  inventory_confidence text not null default 'unverified',
  lead_time_days integer,
  dropship_available boolean not null default false,
  dropship_cost_cents integer,
  shipping_origin text,
  shipping_restrictions text[] not null default '{}',
  back_order_status text,
  last_synchronized_at timestamptz,
  preferred_supplier_rank integer not null default 100,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_inventory_records (
  id text primary key,
  variant_id text not null references public.frizi_commerce_product_variants(id),
  location_id text not null,
  quantity_on_hand integer not null default 0,
  quantity_reserved integer not null default 0,
  quantity_available integer generated always as (quantity_on_hand - quantity_reserved) stored,
  reorder_point integer,
  reorder_quantity integer,
  lot_number text,
  batch_number text,
  expiry_date date,
  received_date date,
  supplier_id text references public.frizi_commerce_suppliers(id),
  unit_cost_cents integer,
  landed_cost_cents integer,
  damaged_quantity integer not null default 0,
  quarantined_quantity integer not null default 0,
  recalled_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_product_recommendations (
  id text primary key,
  customer_id text not null,
  professional_id text not null,
  salon_id text,
  appointment_id text,
  product_variant_id text not null references public.frizi_commerce_product_variants(id),
  recommendation_reason text,
  usage_instructions text,
  frequency text,
  priority text,
  recommended_at timestamptz not null default now(),
  active boolean not null default true,
  consent_visibility_status text not null default 'visible_to_customer',
  attribution_status text not null default 'active',
  commission_rate_bps integer not null default 0,
  commission_rule_version text,
  attribution_start_at timestamptz not null default now(),
  attribution_expires_at timestamptz,
  reassignment_history jsonb not null default '[]'::jsonb,
  disputed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_carts (
  id text primary key,
  customer_id text not null,
  status text not null default 'active',
  currency text not null default 'cad',
  shipping_destination jsonb not null default '{}'::jsonb,
  promo_code text,
  latest_price_snapshot jsonb,
  quote_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_cart_items (
  id text primary key,
  cart_id text not null references public.frizi_commerce_carts(id),
  variant_id text not null references public.frizi_commerce_product_variants(id),
  recommendation_id text references public.frizi_product_recommendations(id),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_orders (
  id text primary key,
  customer_id text not null,
  status text not null default 'draft',
  currency text not null default 'cad',
  seller_identity text not null default 'Frizi Commerce Canada',
  customer_service_contact text,
  payment_status text not null default 'awaiting_payment',
  fulfillment_status text not null default 'awaiting_purchase',
  shipping_address jsonb not null default '{}'::jsonb,
  price_snapshot_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  policy_version text not null,
  accepted_terms_at timestamptz,
  compliance_hold_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_order_price_snapshots (
  id text primary key,
  order_id text references public.frizi_commerce_orders(id),
  snapshot_hash text not null unique,
  pricing_version text not null,
  snapshot jsonb not null,
  merchandise_subtotal_cents integer not null,
  product_discount_cents integer not null default 0,
  shipping_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null,
  currency text not null default 'cad',
  created_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_order_items (
  id text primary key,
  order_id text not null references public.frizi_commerce_orders(id),
  product_id text not null references public.frizi_commerce_products(id),
  variant_id text not null references public.frizi_commerce_product_variants(id),
  recommendation_id text references public.frizi_product_recommendations(id),
  supplier_listing_id text references public.frizi_commerce_supplier_listings(id),
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null,
  discount_cents integer not null default 0,
  line_net_cents integer not null,
  tax_cents integer not null default 0,
  return_policy_id text,
  fulfillment_status text not null default 'awaiting_purchase',
  created_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_shipments (
  id text primary key,
  order_id text not null references public.frizi_commerce_orders(id),
  provider text not null default 'manual_flat_rate',
  service text,
  status text not null default 'label_required',
  package_id text,
  package_snapshot jsonb not null default '{}'::jsonb,
  shipping_quote_snapshot jsonb not null default '{}'::jsonb,
  label_file_url text,
  tracking_number text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_commissions (
  id text primary key,
  order_id text not null references public.frizi_commerce_orders(id),
  order_item_id text not null references public.frizi_commerce_order_items(id),
  professional_id text not null,
  salon_id text,
  recommendation_id text references public.frizi_product_recommendations(id),
  commission_base_cents integer not null,
  commission_rate_bps integer not null,
  commission_cents integer not null,
  commission_rule_version text not null,
  status text not null default 'pending_return_window',
  payable_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_commission_adjustments (
  id text primary key,
  commission_id text not null references public.frizi_commerce_commissions(id),
  adjustment_type text not null,
  amount_cents integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_returns (
  id text primary key,
  order_id text not null references public.frizi_commerce_orders(id),
  status text not null default 'requested',
  reason text not null,
  customer_notes text,
  refund_allocation jsonb not null default '{}'::jsonb,
  inventory_disposition text not null default 'not_resellable_until_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_product_safety_incidents (
  id text primary key,
  product_id text references public.frizi_commerce_products(id),
  variant_id text references public.frizi_commerce_product_variants(id),
  lot_or_batch text,
  customer_id text,
  order_id text references public.frizi_commerce_orders(id),
  date_reported timestamptz not null default now(),
  incident_description text not null,
  photos jsonb not null default '[]'::jsonb,
  severity text not null default 'unreviewed',
  medical_attention_indicator boolean not null default false,
  supplier_notified_at timestamptz,
  manufacturer_notified_at timestamptz,
  regulatory_review_status text not null default 'pending_review',
  health_canada_reporting_status text not null default 'not_assessed',
  corrective_action text,
  recall_id text,
  internal_owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_product_recalls (
  id text primary key,
  status text not null default 'draft',
  product_id text references public.frizi_commerce_products(id),
  variant_id text references public.frizi_commerce_product_variants(id),
  lot_or_batch text,
  recall_reason text not null,
  affected_order_ids text[] not null default '{}',
  customers_notified integer not null default 0,
  unconfirmed_customers integer not null default 0,
  refund_status text not null default 'not_started',
  supplier_recovery_status text not null default 'not_started',
  approved_notice text,
  authorized_by text,
  authorized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_consent_records (
  id text primary key,
  customer_id text not null,
  consent_type text not null,
  consent_basis text not null,
  consent_version text not null,
  source text not null,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.frizi_commerce_audit_logs (
  id text primary key,
  actor_id text,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

comment on table public.frizi_commerce_products is 'Master product identity and Canadian compliance state. Uploading a product must not make it purchasable.';
comment on table public.frizi_commerce_product_variants is 'Each sellable size, scent, shade, package, or formulation variant.';
comment on table public.frizi_commerce_supplier_listings is 'Supplier-specific availability, cost, resale permission, and fulfillment data.';
comment on table public.frizi_product_recommendations is 'Durable client-product-professional attribution records.';
comment on table public.frizi_commerce_order_price_snapshots is 'Immutable order pricing snapshots for receipts, refunds, tax, and commission records.';
comment on table public.frizi_product_recalls is 'Admin-authorized recall workflow. Recalls block sale and identify affected customers.';
