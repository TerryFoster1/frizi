-- Frizi CRM and CMS foundation.
-- Additive schema for client profiles, professionals, CRM notes, appointments,
-- reviews, portfolio/content assets, CMS pages, and admin audit controls.
-- Policies are intentionally conservative. Public read/write access should be
-- expanded only after the auth and role model is finalized.

create table if not exists public.frizi_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  account_type text not null check (account_type in ('client', 'professional', 'admin')),
  display_name text not null,
  email text,
  phone text,
  profile_photo_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_clients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.frizi_profiles(id),
  preferred_name text,
  hair_profile jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  communication_preferences jsonb not null default '{}'::jsonb,
  privacy_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_professionals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.frizi_profiles(id),
  public_slug text unique,
  display_name text not null,
  studio_name text,
  salon_id text,
  bio text,
  specialties text[] not null default '{}',
  services jsonb not null default '[]'::jsonb,
  location jsonb not null default '{}'::jsonb,
  booking_settings jsonb not null default '{}'::jsonb,
  stripe_connected_account_id text,
  public_profile_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_client_professional_relationships (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.frizi_clients(id),
  professional_id uuid not null references public.frizi_professionals(id),
  status text not null default 'active',
  source text,
  first_appointment_at timestamptz,
  last_appointment_at timestamptz,
  next_appointment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, professional_id)
);

create table if not exists public.frizi_crm_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.frizi_clients(id),
  professional_id uuid not null references public.frizi_professionals(id),
  appointment_id uuid,
  note_type text not null default 'general',
  body text not null,
  visibility text not null default 'professional_private',
  created_by uuid references public.frizi_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.frizi_clients(id),
  professional_id uuid not null references public.frizi_professionals(id),
  service_snapshot jsonb not null default '{}'::jsonb,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'requested',
  payment_status text not null default 'unpaid',
  booking_source text not null default 'client_app',
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_client_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.frizi_clients(id),
  professional_id uuid references public.frizi_professionals(id),
  appointment_id uuid references public.frizi_appointments(id),
  image_url text not null,
  photo_type text not null check (photo_type in ('profile', 'hair_history', 'example_reference')),
  consent_status text not null default 'private',
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.frizi_clients(id),
  professional_id uuid not null references public.frizi_professionals(id),
  appointment_id uuid references public.frizi_appointments(id),
  rating numeric(2,1) not null check (rating >= 1 and rating <= 5),
  review_text text,
  public_status text not null default 'pending_consent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_portfolio_assets (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.frizi_professionals(id),
  client_id uuid references public.frizi_clients(id),
  appointment_id uuid references public.frizi_appointments(id),
  image_url text not null,
  caption text,
  tags text[] not null default '{}',
  consent_status text not null default 'pending',
  public_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  page_type text not null default 'page',
  status text not null default 'draft',
  seo jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_by uuid references public.frizi_profiles(id),
  updated_by uuid references public.frizi_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_cms_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.frizi_cms_pages(id) on delete cascade,
  block_order integer not null default 0,
  block_type text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_admin_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.frizi_profiles(id),
  role text not null,
  scope text not null default 'global',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (profile_id, role, scope)
);

create table if not exists public.frizi_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.frizi_profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

alter table public.frizi_profiles enable row level security;
alter table public.frizi_clients enable row level security;
alter table public.frizi_professionals enable row level security;
alter table public.frizi_client_professional_relationships enable row level security;
alter table public.frizi_crm_notes enable row level security;
alter table public.frizi_appointments enable row level security;
alter table public.frizi_client_photos enable row level security;
alter table public.frizi_reviews enable row level security;
alter table public.frizi_portfolio_assets enable row level security;
alter table public.frizi_cms_pages enable row level security;
alter table public.frizi_cms_blocks enable row level security;
alter table public.frizi_admin_roles enable row level security;
alter table public.frizi_audit_events enable row level security;

create policy "published cms pages are public readable"
on public.frizi_cms_pages
for select
to anon, authenticated
using (status = 'published');

create policy "published cms blocks are public readable"
on public.frizi_cms_blocks
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.frizi_cms_pages
    where frizi_cms_pages.id = frizi_cms_blocks.page_id
      and frizi_cms_pages.status = 'published'
  )
);

create policy "published professional profiles are public readable"
on public.frizi_professionals
for select
to anon, authenticated
using (public_profile_status = 'published');

create policy "approved reviews are public readable"
on public.frizi_reviews
for select
to anon, authenticated
using (public_status = 'published');

create policy "approved portfolio assets are public readable"
on public.frizi_portfolio_assets
for select
to anon, authenticated
using (public_status = 'published' and consent_status = 'approved');

comment on table public.frizi_clients is 'Client CRM hair profile, preferences, and privacy settings.';
comment on table public.frizi_professionals is 'Professional public profile, booking settings, and CRM owner record.';
comment on table public.frizi_crm_notes is 'Private professional CRM notes scoped to a client/professional relationship.';
comment on table public.frizi_cms_pages is 'CMS page metadata for public and admin-managed content.';
comment on table public.frizi_cms_blocks is 'Ordered CMS content blocks attached to CMS pages.';
