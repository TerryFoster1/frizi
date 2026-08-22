create table if not exists public.frizi_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.frizi_notifications(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'push', 'email')),
  device_subscription_id uuid references public.frizi_device_subscriptions(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  provider text,
  provider_message_id text,
  error_code text,
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, channel, device_subscription_id)
);

create index if not exists frizi_notification_deliveries_notification_idx
  on public.frizi_notification_deliveries (notification_id, channel, status);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'frizi_device_subscriptions_user_token_unique'
      and conrelid = 'public.frizi_device_subscriptions'::regclass
  ) then
    alter table public.frizi_device_subscriptions
      add constraint frizi_device_subscriptions_user_token_unique
      unique (user_id, device_token);
  end if;
end
$$;

alter table public.frizi_notification_deliveries enable row level security;

drop policy if exists "users can read own notification deliveries" on public.frizi_notification_deliveries;
create policy "users can read own notification deliveries"
on public.frizi_notification_deliveries
for select
to authenticated
using (
  exists (
    select 1
    from public.frizi_notifications notification
    where notification.id = frizi_notification_deliveries.notification_id
      and notification.recipient_user_id = (select auth.uid())
  )
);

grant select on public.frizi_notification_deliveries to authenticated;

comment on table public.frizi_notification_deliveries is
  'Internal delivery log for canonical Frizi notifications. In-app is stored by frizi_notifications; push/email attempts attach here without creating duplicate notification systems.';
