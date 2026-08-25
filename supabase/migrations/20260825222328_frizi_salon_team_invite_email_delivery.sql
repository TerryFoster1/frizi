alter table public.frizi_salon_team_invitations
  add column if not exists provider_message_id text,
  add column if not exists delivery_error text;

comment on column public.frizi_salon_team_invitations.provider_message_id is
  'Safe transactional-email provider message identifier for Salon team invite delivery. Never stores provider credentials.';

comment on column public.frizi_salon_team_invitations.delivery_error is
  'Safe last delivery failure detail for Salon team invite email troubleshooting. Do not store invite tokens or credentials.';
