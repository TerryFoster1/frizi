create extension if not exists pgcrypto;

alter table public.frizi_professionals
  drop constraint if exists frizi_professionals_onboarding_status_check;

alter table public.frizi_professionals
  add constraint frizi_professionals_onboarding_status_check
  check (
    onboarding_status = any (
      array[
        'profile_draft',
        'profile_saved',
        'services_skipped',
        'services_saved',
        'availability_saved',
        'dashboard_ready',
        'complete'
      ]::text[]
    )
  );

alter table public.frizi_clients
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists profile_photo_url text,
  add column if not exists account_claimed_at timestamptz,
  add column if not exists created_by_professional_id uuid references public.frizi_professionals(id);

alter table public.frizi_client_professional_relationships
  alter column client_id drop not null,
  add column if not exists manual_contact_id uuid,
  add column if not exists first_connected_at timestamptz not null default now(),
  add column if not exists professional_private_notes text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists preferred_services text[] not null default '{}'::text[],
  add column if not exists marketing_consent_status text not null default 'unknown',
  add column if not exists invite_status text,
  add column if not exists account_claimed_status text not null default 'unclaimed',
  add column if not exists preferred_contact_method text,
  add column if not exists last_service text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'frizi_relationship_registered_or_manual_client_check'
  ) then
    alter table public.frizi_client_professional_relationships
      add constraint frizi_relationship_registered_or_manual_client_check
      check (client_id is not null or manual_contact_id is not null);
  end if;
end $$;

create unique index if not exists frizi_relationship_registered_unique_idx
  on public.frizi_client_professional_relationships (professional_id, client_id)
  where client_id is not null;

create unique index if not exists frizi_relationship_manual_unique_idx
  on public.frizi_client_professional_relationships (professional_id, manual_contact_id)
  where manual_contact_id is not null;

create table if not exists public.frizi_professional_invites (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.frizi_professionals(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  source text not null default 'qr',
  expires_at timestamptz,
  accepted_count integer not null default 0 check (accepted_count >= 0),
  last_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.frizi_professional_invites enable row level security;
alter table public.frizi_clients enable row level security;
alter table public.frizi_client_professional_relationships enable row level security;
alter table public.frizi_appointments enable row level security;
alter table public.frizi_promotions enable row level security;

create or replace function public.frizi_current_professional_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select pro.id
  from public.frizi_professionals pro
  join public.frizi_profiles profile on profile.id = pro.profile_id
  where profile.auth_user_id = (select auth.uid())
  limit 1
$$;

drop policy if exists "professionals can manage own invite links" on public.frizi_professional_invites;
create policy "professionals can manage own invite links"
on public.frizi_professional_invites
for all
to authenticated
using (professional_id = public.frizi_current_professional_id())
with check (professional_id = public.frizi_current_professional_id());

drop policy if exists "active invite links are public readable" on public.frizi_professional_invites;
create policy "active invite links are public readable"
on public.frizi_professional_invites
for select
to anon, authenticated
using (status = 'active' and (expires_at is null or expires_at > now()));

drop policy if exists "professionals can create CRM clients" on public.frizi_clients;
create policy "professionals can create CRM clients"
on public.frizi_clients
for insert
to authenticated
with check (created_by_professional_id = public.frizi_current_professional_id());

drop policy if exists "professionals can read their CRM clients" on public.frizi_clients;
create policy "professionals can read their CRM clients"
on public.frizi_clients
for select
to authenticated
using (
  profile_id in (select id from public.frizi_profiles where auth_user_id = (select auth.uid()))
  or exists (
    select 1
    from public.frizi_client_professional_relationships rel
    where rel.client_id = frizi_clients.id
      and rel.professional_id = public.frizi_current_professional_id()
  )
  or created_by_professional_id = public.frizi_current_professional_id()
);

drop policy if exists "professionals can update their CRM clients" on public.frizi_clients;
create policy "professionals can update their CRM clients"
on public.frizi_clients
for update
to authenticated
using (
  created_by_professional_id = public.frizi_current_professional_id()
  or exists (
    select 1
    from public.frizi_client_professional_relationships rel
    where rel.client_id = frizi_clients.id
      and rel.professional_id = public.frizi_current_professional_id()
  )
)
with check (
  created_by_professional_id = public.frizi_current_professional_id()
  or exists (
    select 1
    from public.frizi_client_professional_relationships rel
    where rel.client_id = frizi_clients.id
      and rel.professional_id = public.frizi_current_professional_id()
  )
);

drop policy if exists "professionals can manage own CRM relationships" on public.frizi_client_professional_relationships;
create policy "professionals can manage own CRM relationships"
on public.frizi_client_professional_relationships
for all
to authenticated
using (professional_id = public.frizi_current_professional_id())
with check (professional_id = public.frizi_current_professional_id());

drop policy if exists "professionals can manage own appointments" on public.frizi_appointments;
create policy "professionals can manage own appointments"
on public.frizi_appointments
for all
to authenticated
using (professional_id = public.frizi_current_professional_id())
with check (professional_id = public.frizi_current_professional_id());

drop policy if exists "professionals can manage own promotions" on public.frizi_promotions;
create policy "professionals can manage own promotions"
on public.frizi_promotions
for all
to authenticated
using (created_by = (public.frizi_current_professional_id())::text)
with check (created_by = (public.frizi_current_professional_id())::text);

grant usage on schema public to anon, authenticated;
grant select on public.frizi_professional_invites to anon, authenticated;
grant select, insert, update on public.frizi_clients to authenticated;
grant select, insert, update on public.frizi_client_professional_relationships to authenticated;
grant select, insert, update on public.frizi_appointments to authenticated;
grant select, insert, update on public.frizi_promotions to authenticated;
