-- Frizi Salon connected-team invitation lifecycle.
-- Stores expiring, hashed invite tokens for connecting existing or new Pro users
-- to a Salon staff assignment without trusting browser-provided salon/pro IDs.

create table if not exists public.frizi_salon_team_invitations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  location_id uuid references public.frizi_salon_locations(id) on delete set null,
  staff_assignment_id uuid references public.frizi_salon_staff_assignments(id) on delete set null,
  invited_email text not null,
  invited_name text,
  professional_title text,
  role text not null default 'staff'
    check (role in ('manager', 'reception', 'staff')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  token_hash text not null unique,
  delivery_status text not null default 'link_ready'
    check (delivery_status in ('link_ready', 'queued', 'sent', 'failed')),
  accepted_profile_id uuid references public.frizi_profiles(id) on delete set null,
  accepted_professional_id uuid references public.frizi_professionals(id) on delete set null,
  invited_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  last_sent_at timestamptz,
  resend_count integer not null default 0,
  accepted_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists frizi_salon_team_invitations_salon_status_idx
  on public.frizi_salon_team_invitations (salon_id, status, expires_at);

create index if not exists frizi_salon_team_invitations_email_idx
  on public.frizi_salon_team_invitations (lower(invited_email), status);

create unique index if not exists frizi_salon_team_invitations_pending_email_idx
  on public.frizi_salon_team_invitations (salon_id, lower(invited_email))
  where status = 'pending';

alter table public.frizi_salon_team_invitations enable row level security;

drop policy if exists "salon managers can read team invitations" on public.frizi_salon_team_invitations;
create policy "salon managers can read team invitations"
on public.frizi_salon_team_invitations
for select
to authenticated
using (public.frizi_can_manage_salon(salon_id));

drop policy if exists "salon managers can create team invitations" on public.frizi_salon_team_invitations;
create policy "salon managers can create team invitations"
on public.frizi_salon_team_invitations
for insert
to authenticated
with check (public.frizi_can_manage_salon(salon_id));

drop policy if exists "salon managers can update team invitations" on public.frizi_salon_team_invitations;
create policy "salon managers can update team invitations"
on public.frizi_salon_team_invitations
for update
to authenticated
using (public.frizi_can_manage_salon(salon_id))
with check (public.frizi_can_manage_salon(salon_id));

comment on table public.frizi_salon_team_invitations is
  'Secure expiring invitation records for connecting Frizi Pro accounts to Salon staff assignments. Raw invite tokens are never stored.';
