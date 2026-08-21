alter table public.frizi_promotions
  drop constraint if exists frizi_promotions_discount_type_check;

alter table public.frizi_promotions
  add constraint frizi_promotions_discount_type_check
  check (discount_type in ('percentage', 'fixed_amount', 'free_item', 'custom_offer'));

alter table public.frizi_promotions
  add column if not exists image_url text,
  add column if not exists image_path text,
  add column if not exists text_placement text not null default 'bottom'
    check (text_placement in ('top', 'bottom', 'left', 'right', 'center'));

comment on column public.frizi_promotions.image_url is
  'Public URL for professional-uploaded promo creative stored in the secured Frizi Pro media bucket.';

comment on column public.frizi_promotions.image_path is
  'Storage object path for the uploaded promo creative.';

comment on column public.frizi_promotions.text_placement is
  'Structured promo preview text placement used by Frizi Pro creative rendering.';
