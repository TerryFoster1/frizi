insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'frizi-pro-media',
  'frizi-pro-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read frizi pro media" on storage.objects;
drop policy if exists "professionals can upload own frizi pro media" on storage.objects;
drop policy if exists "professionals can update own frizi pro media" on storage.objects;
drop policy if exists "professionals can delete own frizi pro media" on storage.objects;

create policy "public can read frizi pro media"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'frizi-pro-media');

create policy "professionals can upload own frizi pro media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'frizi-pro-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "professionals can update own frizi pro media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'frizi-pro-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'frizi-pro-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "professionals can delete own frizi pro media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'frizi-pro-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
