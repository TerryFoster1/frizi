-- Product catalogue media bucket for Frizi Admin.
-- Uploads are performed only through the authenticated Admin API with the
-- server-side Supabase secret key. Public read allows Client/Pro catalogue
-- surfaces to display approved product images without signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'frizi-product-media',
  'frizi-product-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read frizi product media" on storage.objects;
drop policy if exists "authenticated users can upload frizi product media" on storage.objects;
drop policy if exists "authenticated users can update frizi product media" on storage.objects;
drop policy if exists "authenticated users can delete frizi product media" on storage.objects;

create policy "public can read frizi product media"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'frizi-product-media');

comment on policy "public can read frizi product media" on storage.objects is
  'Product catalogue images are public-read after upload through the Frizi Admin server API.';
