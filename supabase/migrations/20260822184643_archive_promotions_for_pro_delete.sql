alter table public.frizi_promotions
  add column if not exists archived_at timestamptz;

create index if not exists frizi_promotions_created_by_archived_updated_idx
  on public.frizi_promotions (created_by, archived_at, updated_at desc);

comment on column public.frizi_promotions.archived_at is
  'Professional-facing soft-delete marker. Archived promotions are hidden from the saved promo library while preserving historical messages, campaigns, and redemptions.';
