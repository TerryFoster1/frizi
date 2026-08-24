alter table public.frizi_professionals
  add column if not exists professional_title text;

comment on column public.frizi_professionals.professional_title is
  'Client-facing professional title, such as Barber, Colourist, Stylist, or Owner. Public clients should omit this when blank instead of falling back to Other.';
