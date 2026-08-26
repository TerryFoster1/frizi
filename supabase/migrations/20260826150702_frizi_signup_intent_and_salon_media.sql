-- Harden cross-app signup intent and add canonical Salon brand media storage.

create or replace function public.frizi_prevent_profile_account_type_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.account_type is distinct from new.account_type then
    raise exception 'Frizi account type cannot be changed once created.';
  end if;

  return new;
end;
$$;

drop trigger if exists frizi_profiles_prevent_account_type_change on public.frizi_profiles;
create trigger frizi_profiles_prevent_account_type_change
before update of account_type on public.frizi_profiles
for each row
execute function public.frizi_prevent_profile_account_type_change();

comment on function public.frizi_prevent_profile_account_type_change() is
  'Prevents one Frizi Auth identity from being mutated from Client to Pro to Salon, or any other product identity swap.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'frizi-salon-media',
  'frizi-salon-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read frizi salon media" on storage.objects;
drop policy if exists "salon owners can upload own frizi salon media" on storage.objects;
drop policy if exists "salon owners can update own frizi salon media" on storage.objects;
drop policy if exists "salon owners can delete own frizi salon media" on storage.objects;

create policy "public can read frizi salon media"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'frizi-salon-media');

create policy "salon owners can upload own frizi salon media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'frizi-salon-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "salon owners can update own frizi salon media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'frizi-salon-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'frizi-salon-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "salon owners can delete own frizi salon media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'frizi-salon-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Public Salon logo and header media. Object paths are scoped by authenticated owner user id.
