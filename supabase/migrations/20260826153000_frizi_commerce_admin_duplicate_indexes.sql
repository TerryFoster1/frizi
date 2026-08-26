-- Product-admin duplicate/search support.
-- Keep the canonical commerce catalogue durable while avoiding accidental duplicate
-- supplier or variant records during manual entry and CSV preview/import.

create index if not exists frizi_commerce_products_brand_product_search_idx
  on public.frizi_commerce_products (lower(brand_name), lower(product_name));

create index if not exists frizi_commerce_products_category_search_idx
  on public.frizi_commerce_products using gin (product_categories);

create unique index if not exists frizi_commerce_supplier_listings_supplier_sku_unique_idx
  on public.frizi_commerce_supplier_listings (supplier_id, lower(supplier_sku))
  where supplier_sku is not null and supplier_sku <> '';

comment on index public.frizi_commerce_products_brand_product_search_idx is
  'Supports admin duplicate review and catalogue search by normalized brand and product name.';

comment on index public.frizi_commerce_supplier_listings_supplier_sku_unique_idx is
  'Prevents duplicate supplier SKU listings for the same supplier during admin imports.';
