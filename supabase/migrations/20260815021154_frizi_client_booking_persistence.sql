alter table public.frizi_appointments
  add column if not exists service_id text references public.frizi_services(id),
  add column if not exists client_notes text,
  add column if not exists reference_photo_urls text[] not null default '{}'::text[],
  add column if not exists payment_requirement text not null default 'pay_at_appointment'
    check (payment_requirement in ('pay_at_appointment', 'frizi_payment_optional', 'deposit_required', 'full_prepayment_required')),
  add column if not exists payment_required_cents integer not null default 0 check (payment_required_cents >= 0);

alter table public.frizi_appointments
  drop constraint if exists frizi_appointments_status_check,
  add constraint frizi_appointments_status_check
    check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed', 'requested'));

alter table public.frizi_appointments
  drop constraint if exists frizi_appointments_payment_status_check,
  add constraint frizi_appointments_payment_status_check
    check (payment_status in ('not_required', 'unpaid', 'awaiting_payment', 'deposit_paid', 'paid', 'refunded', 'failed'));

update public.frizi_appointments
set status = 'pending'
where status = 'requested';

alter table public.frizi_appointments
  alter column status set default 'pending',
  alter column payment_status set default 'not_required';

create index if not exists frizi_appointments_client_starts_idx
  on public.frizi_appointments (client_id, starts_at desc);

create index if not exists frizi_appointments_professional_starts_idx
  on public.frizi_appointments (professional_id, starts_at);

drop index if exists public.frizi_appointments_no_active_slot_overlap_idx;

create unique index frizi_appointments_no_active_slot_overlap_idx
  on public.frizi_appointments (professional_id, starts_at)
  where status in ('pending', 'confirmed');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'frizi-client-media',
  'frizi-client-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "clients can read own client media" on storage.objects;
drop policy if exists "clients can upload own client media" on storage.objects;
drop policy if exists "clients can update own client media" on storage.objects;
drop policy if exists "clients can delete own client media" on storage.objects;

create policy "clients can read own client media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'frizi-client-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "clients can upload own client media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'frizi-client-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "clients can update own client media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'frizi-client-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'frizi-client-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "clients can delete own client media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'frizi-client-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.frizi_current_client_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select c.id
  from public.frizi_clients c
  join public.frizi_profiles p on p.id = c.profile_id
  where p.auth_user_id = (select auth.uid())
  limit 1
$$;

drop policy if exists "clients can create own client profile" on public.frizi_clients;
create policy "clients can create own client profile"
on public.frizi_clients
for insert
to authenticated
with check (
  profile_id in (
    select id from public.frizi_profiles where auth_user_id = (select auth.uid())
  )
);

drop policy if exists "clients can read own client profile" on public.frizi_clients;
create policy "clients can read own client profile"
on public.frizi_clients
for select
to authenticated
using (
  profile_id in (
    select id from public.frizi_profiles where auth_user_id = (select auth.uid())
  )
);

drop policy if exists "clients can update own client profile" on public.frizi_clients;
create policy "clients can update own client profile"
on public.frizi_clients
for update
to authenticated
using (
  profile_id in (
    select id from public.frizi_profiles where auth_user_id = (select auth.uid())
  )
)
with check (
  profile_id in (
    select id from public.frizi_profiles where auth_user_id = (select auth.uid())
  )
);

drop policy if exists "clients can read own appointments" on public.frizi_appointments;
create policy "clients can read own appointments"
on public.frizi_appointments
for select
to authenticated
using (client_id = public.frizi_current_client_id());

drop policy if exists "clients can read own CRM relationships" on public.frizi_client_professional_relationships;
create policy "clients can read own CRM relationships"
on public.frizi_client_professional_relationships
for select
to authenticated
using (client_id = public.frizi_current_client_id());

drop policy if exists "clients can manage own photos" on public.frizi_client_photos;
create policy "clients can manage own photos"
on public.frizi_client_photos
for all
to authenticated
using (client_id = public.frizi_current_client_id())
with check (client_id = public.frizi_current_client_id());

drop policy if exists "professionals can read connected client photos" on public.frizi_client_photos;
create policy "professionals can read connected client photos"
on public.frizi_client_photos
for select
to authenticated
using (
  professional_id = public.frizi_current_professional_id()
  or exists (
    select 1
    from public.frizi_client_professional_relationships rel
    where rel.client_id = frizi_client_photos.client_id
      and rel.professional_id = public.frizi_current_professional_id()
      and rel.status = 'active'
  )
);

grant select, insert, update on public.frizi_clients to authenticated;
grant select on public.frizi_client_professional_relationships to authenticated;
grant select on public.frizi_appointments to authenticated;
grant select, insert, update, delete on public.frizi_client_photos to authenticated;
