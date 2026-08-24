create table if not exists public.frizi_user_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.frizi_profiles(id) on delete cascade,
  role text not null check (role in ('client', 'professional', 'admin', 'commerce_operator', 'salon_owner', 'salon_manager', 'receptionist')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended', 'revoked')),
  granted_by uuid references public.frizi_profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, role)
);

alter table public.frizi_user_roles enable row level security;

create table if not exists public.frizi_professional_locations (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.frizi_professionals(id) on delete cascade,
  label text,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  province text not null check (province in ('AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT')),
  postal_code text not null,
  country text not null default 'CA',
  latitude numeric,
  longitude numeric,
  geocoding_status text not null default 'not_started' check (geocoding_status in ('not_started', 'queued', 'verified', 'failed')),
  service_radius_km numeric,
  online_booking_enabled boolean not null default true,
  primary_location boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists frizi_professional_locations_one_primary_idx
  on public.frizi_professional_locations (professional_id)
  where primary_location = true and active = true;

create index if not exists frizi_professional_locations_city_province_idx
  on public.frizi_professional_locations (city, province)
  where active = true;

alter table public.frizi_professional_locations enable row level security;

alter table public.frizi_professionals
  add column if not exists primary_specialty text,
  add column if not exists instagram_url text,
  add column if not exists onboarding_status text not null default 'profile_draft'
    check (onboarding_status in ('profile_draft', 'profile_saved', 'services_skipped', 'services_saved', 'dashboard_ready')),
  add column if not exists subscription_status text not null default 'unknown'
    check (subscription_status in ('unknown', 'checkout_started', 'active', 'past_due', 'cancelled', 'incomplete')),
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_checked_at timestamptz,
  add column if not exists bookable boolean not null default false;

create unique index if not exists frizi_professionals_one_per_profile_idx
  on public.frizi_professionals (profile_id)
  where profile_id is not null;

alter table public.frizi_services
  add column if not exists category text not null default 'Other',
  add column if not exists duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  add column if not exists pricing_type text not null default 'fixed'
    check (pricing_type in ('fixed', 'starting_at', 'price_varies', 'free_consultation')),
  add column if not exists deposit_type text not null default 'none'
    check (deposit_type in ('none', 'fixed', 'percentage')),
  add column if not exists deposit_amount_cents integer not null default 0 check (deposit_amount_cents >= 0),
  add column if not exists deposit_percentage integer not null default 0 check (deposit_percentage >= 0 and deposit_percentage <= 100),
  add column if not exists buffer_before_minutes integer not null default 0 check (buffer_before_minutes >= 0),
  add column if not exists buffer_after_minutes integer not null default 0 check (buffer_after_minutes >= 0),
  add column if not exists online_booking_enabled boolean not null default true,
  add column if not exists new_clients_allowed boolean not null default true,
  add column if not exists existing_clients_only boolean not null default false,
  add column if not exists display_order integer not null default 100,
  add column if not exists service_metadata jsonb not null default '{}'::jsonb,
  add constraint frizi_services_deposit_fixed_amount_check
    check (deposit_type <> 'fixed' or pricing_type <> 'fixed' or deposit_amount_cents <= base_price_cents);

create table if not exists public.frizi_service_addons (
  id text primary key,
  service_id text not null references public.frizi_services(id) on delete cascade,
  professional_id text not null,
  name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists frizi_service_addons_service_idx
  on public.frizi_service_addons (service_id, display_order);

alter table public.frizi_service_addons enable row level security;

create table if not exists public.frizi_professional_onboarding_migrations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.frizi_profiles(id) on delete cascade,
  source text not null,
  source_key text not null,
  migrated_at timestamptz not null default now(),
  status text not null default 'migrated' check (status in ('migrated', 'skipped', 'failed')),
  details jsonb not null default '{}'::jsonb,
  unique (profile_id, source_key)
);

alter table public.frizi_professional_onboarding_migrations enable row level security;

create table if not exists public.frizi_professional_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.frizi_profiles(id) on delete cascade,
  professional_id uuid references public.frizi_professionals(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text unique,
  status text not null default 'checkout_started'
    check (status in ('checkout_started', 'active', 'past_due', 'cancelled', 'incomplete')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.frizi_professional_subscriptions enable row level security;

create index if not exists frizi_professional_subscriptions_profile_idx
  on public.frizi_professional_subscriptions (profile_id, status);

create policy "users can read own app profile"
  on public.frizi_profiles for select
  to authenticated
  using ((select auth.uid()) = auth_user_id);

create policy "users can create own app profile"
  on public.frizi_profiles for insert
  to authenticated
  with check ((select auth.uid()) = auth_user_id);

create policy "users can update own app profile"
  on public.frizi_profiles for update
  to authenticated
  using ((select auth.uid()) = auth_user_id)
  with check ((select auth.uid()) = auth_user_id);

create policy "users can read own roles"
  on public.frizi_user_roles for select
  to authenticated
  using (
    exists (
      select 1 from public.frizi_profiles p
      where p.id = frizi_user_roles.profile_id
        and p.auth_user_id = (select auth.uid())
    )
  );

create policy "users can create own professional role"
  on public.frizi_user_roles for insert
  to authenticated
  with check (
    role in ('client', 'professional')
    and exists (
      select 1 from public.frizi_profiles p
      where p.id = frizi_user_roles.profile_id
        and p.auth_user_id = (select auth.uid())
    )
  );

create policy "professionals can read own unpublished profile"
  on public.frizi_professionals for select
  to authenticated
  using (
    exists (
      select 1 from public.frizi_profiles p
      where p.id = frizi_professionals.profile_id
        and p.auth_user_id = (select auth.uid())
    )
  );

create policy "professionals can create own profile"
  on public.frizi_professionals for insert
  to authenticated
  with check (
    exists (
      select 1 from public.frizi_profiles p
      where p.id = frizi_professionals.profile_id
        and p.auth_user_id = (select auth.uid())
    )
  );

create policy "professionals can update own profile"
  on public.frizi_professionals for update
  to authenticated
  using (
    exists (
      select 1 from public.frizi_profiles p
      where p.id = frizi_professionals.profile_id
        and p.auth_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.frizi_profiles p
      where p.id = frizi_professionals.profile_id
        and p.auth_user_id = (select auth.uid())
    )
  );

create policy "public can read active professional locations"
  on public.frizi_professional_locations for select
  to anon, authenticated
  using (
    active = true
    and exists (
      select 1 from public.frizi_professionals pro
      where pro.id = frizi_professional_locations.professional_id
        and pro.public_profile_status = 'published'
    )
  );

create policy "professionals can manage own locations"
  on public.frizi_professional_locations for all
  to authenticated
  using (
    exists (
      select 1
      from public.frizi_professionals pro
      join public.frizi_profiles p on p.id = pro.profile_id
      where pro.id = frizi_professional_locations.professional_id
        and p.auth_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.frizi_professionals pro
      join public.frizi_profiles p on p.id = pro.profile_id
      where pro.id = frizi_professional_locations.professional_id
        and p.auth_user_id = (select auth.uid())
    )
  );

create policy "professionals can read own inactive services"
  on public.frizi_services for select
  to authenticated
  using (
    exists (
      select 1
      from public.frizi_professionals pro
      join public.frizi_profiles p on p.id = pro.profile_id
      where pro.id::text = frizi_services.professional_id
        and p.auth_user_id = (select auth.uid())
    )
  );

create policy "professionals can create own services"
  on public.frizi_services for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.frizi_professionals pro
      join public.frizi_profiles p on p.id = pro.profile_id
      where pro.id::text = frizi_services.professional_id
        and p.auth_user_id = (select auth.uid())
    )
  );

create policy "professionals can update own services"
  on public.frizi_services for update
  to authenticated
  using (
    exists (
      select 1
      from public.frizi_professionals pro
      join public.frizi_profiles p on p.id = pro.profile_id
      where pro.id::text = frizi_services.professional_id
        and p.auth_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.frizi_professionals pro
      join public.frizi_profiles p on p.id = pro.profile_id
      where pro.id::text = frizi_services.professional_id
        and p.auth_user_id = (select auth.uid())
    )
  );

create policy "public can read active service addons"
  on public.frizi_service_addons for select
  to anon, authenticated
  using (
    active = true
    and exists (
      select 1 from public.frizi_services s
      where s.id = frizi_service_addons.service_id
        and s.active = true
    )
  );

create policy "professionals can manage own service addons"
  on public.frizi_service_addons for all
  to authenticated
  using (
    exists (
      select 1
      from public.frizi_professionals pro
      join public.frizi_profiles p on p.id = pro.profile_id
      where pro.id::text = frizi_service_addons.professional_id
        and p.auth_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.frizi_professionals pro
      join public.frizi_profiles p on p.id = pro.profile_id
      where pro.id::text = frizi_service_addons.professional_id
        and p.auth_user_id = (select auth.uid())
    )
  );

create policy "users can manage own local onboarding migration markers"
  on public.frizi_professional_onboarding_migrations for all
  to authenticated
  using (
    exists (
      select 1 from public.frizi_profiles p
      where p.id = frizi_professional_onboarding_migrations.profile_id
        and p.auth_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.frizi_profiles p
      where p.id = frizi_professional_onboarding_migrations.profile_id
        and p.auth_user_id = (select auth.uid())
    )
  );

create policy "users can read own professional subscription status"
  on public.frizi_professional_subscriptions for select
  to authenticated
  using (
    exists (
      select 1 from public.frizi_profiles p
      where p.id = frizi_professional_subscriptions.profile_id
        and p.auth_user_id = (select auth.uid())
    )
  );

comment on table public.frizi_user_roles is
  'Normalized multi-role assignments for one Supabase Auth identity. frizi_profiles.account_type remains for compatibility only.';

comment on table public.frizi_professional_locations is
  'Canonical professional location records. Structured for Canadian launch, future geocoding, search radius, multiple locations, salons, and appointment locations.';

comment on table public.frizi_service_addons is
  'Optional add-ons attached to canonical professional services. Prices are integer CAD cents.';

comment on table public.frizi_professional_onboarding_migrations is
  'One-time client-side localStorage migration markers so Pro onboarding data is not silently discarded.';

comment on table public.frizi_professional_subscriptions is
  'Stripe subscription linkage for professional onboarding. Browser redirect flags are not authoritative subscription proof.';
