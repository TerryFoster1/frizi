-- Canonical Frizi messaging, audience, and push-readiness foundation.
-- Messages are in-app first; email/push are delivery channels attached to the
-- same canonical message row.

create or replace function public.frizi_current_client_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select c.id
  from public.frizi_clients c
  join public.frizi_profiles p on p.id = c.profile_id
  where p.auth_user_id = (select auth.uid())
  limit 1
$$;

create table if not exists public.frizi_conversations (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.frizi_professionals(id) on delete cascade,
  client_id uuid not null references public.frizi_clients(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, client_id)
);

create table if not exists public.frizi_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.frizi_conversations(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('professional', 'client', 'system')),
  message_type text not null default 'text',
  body text,
  promotion_id text references public.frizi_promotions(id) on delete set null,
  campaign_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.frizi_message_deliveries (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.frizi_messages(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'push')),
  recipient_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed')),
  provider text,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, channel, recipient_user_id)
);

create table if not exists public.frizi_campaigns (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.frizi_professionals(id) on delete cascade,
  promotion_id text references public.frizi_promotions(id) on delete set null,
  name text not null,
  audience_type text not null default 'filtered' check (audience_type in ('everyone_eligible', 'selected_clients', 'filtered')),
  audience_filters jsonb not null default '{}'::jsonb,
  selected_client_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'draft' check (status in ('draft', 'review', 'scheduled', 'sent', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'frizi_messages_campaign_id_fkey'
      and conrelid = 'public.frizi_messages'::regclass
  ) then
    alter table public.frizi_messages
      add constraint frizi_messages_campaign_id_fkey
      foreign key (campaign_id) references public.frizi_campaigns(id) on delete set null;
  end if;
end
$$;

create table if not exists public.frizi_campaign_audience_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.frizi_campaigns(id) on delete cascade,
  relationship_id uuid not null references public.frizi_client_professional_relationships(id) on delete cascade,
  client_id uuid references public.frizi_clients(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, relationship_id)
);

create table if not exists public.frizi_device_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  provider text not null,
  device_token text,
  subscription jsonb,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists frizi_conversations_professional_idx on public.frizi_conversations (professional_id, updated_at desc);
create index if not exists frizi_conversations_client_idx on public.frizi_conversations (client_id, updated_at desc);
create index if not exists frizi_messages_conversation_idx on public.frizi_messages (conversation_id, created_at desc);
create index if not exists frizi_campaigns_professional_idx on public.frizi_campaigns (professional_id, updated_at desc);
create index if not exists frizi_device_subscriptions_user_idx on public.frizi_device_subscriptions (user_id, active);

alter table public.frizi_conversations enable row level security;
alter table public.frizi_messages enable row level security;
alter table public.frizi_message_deliveries enable row level security;
alter table public.frizi_campaigns enable row level security;
alter table public.frizi_campaign_audience_members enable row level security;
alter table public.frizi_device_subscriptions enable row level security;

drop policy if exists "conversation participants can read conversations" on public.frizi_conversations;
create policy "conversation participants can read conversations"
on public.frizi_conversations
for select
to authenticated
using (
  professional_id = public.frizi_current_professional_id()
  or client_id = public.frizi_current_client_id()
);

drop policy if exists "professionals can create conversations for their CRM clients" on public.frizi_conversations;
create policy "professionals can create conversations for their CRM clients"
on public.frizi_conversations
for insert
to authenticated
with check (
  professional_id = public.frizi_current_professional_id()
  and exists (
    select 1 from public.frizi_client_professional_relationships rel
    where rel.professional_id = frizi_conversations.professional_id
      and rel.client_id = frizi_conversations.client_id
  )
);

drop policy if exists "conversation participants can read messages" on public.frizi_messages;
create policy "conversation participants can read messages"
on public.frizi_messages
for select
to authenticated
using (
  exists (
    select 1 from public.frizi_conversations c
    where c.id = frizi_messages.conversation_id
      and (
        c.professional_id = public.frizi_current_professional_id()
        or c.client_id = public.frizi_current_client_id()
      )
  )
);

drop policy if exists "participants can create their own messages" on public.frizi_messages;
create policy "participants can create their own messages"
on public.frizi_messages
for insert
to authenticated
with check (
  sender_user_id = (select auth.uid())
  and exists (
    select 1 from public.frizi_conversations c
    where c.id = frizi_messages.conversation_id
      and (
        (frizi_messages.sender_role = 'professional' and c.professional_id = public.frizi_current_professional_id())
        or (frizi_messages.sender_role = 'client' and c.client_id = public.frizi_current_client_id())
      )
  )
);

drop policy if exists "participants can read delivery state" on public.frizi_message_deliveries;
create policy "participants can read delivery state"
on public.frizi_message_deliveries
for select
to authenticated
using (
  exists (
    select 1
    from public.frizi_messages m
    join public.frizi_conversations c on c.id = m.conversation_id
    where m.id = frizi_message_deliveries.message_id
      and (
        c.professional_id = public.frizi_current_professional_id()
        or c.client_id = public.frizi_current_client_id()
      )
  )
);

drop policy if exists "professionals can manage own campaigns" on public.frizi_campaigns;
create policy "professionals can manage own campaigns"
on public.frizi_campaigns
for all
to authenticated
using (professional_id = public.frizi_current_professional_id())
with check (professional_id = public.frizi_current_professional_id());

drop policy if exists "professionals can manage own campaign audiences" on public.frizi_campaign_audience_members;
create policy "professionals can manage own campaign audiences"
on public.frizi_campaign_audience_members
for all
to authenticated
using (
  exists (
    select 1 from public.frizi_campaigns campaign
    where campaign.id = frizi_campaign_audience_members.campaign_id
      and campaign.professional_id = public.frizi_current_professional_id()
  )
)
with check (
  exists (
    select 1
    from public.frizi_campaigns campaign
    join public.frizi_client_professional_relationships rel on rel.id = frizi_campaign_audience_members.relationship_id
    where campaign.id = frizi_campaign_audience_members.campaign_id
      and campaign.professional_id = public.frizi_current_professional_id()
      and rel.professional_id = campaign.professional_id
  )
);

drop policy if exists "users can manage own device subscriptions" on public.frizi_device_subscriptions;
create policy "users can manage own device subscriptions"
on public.frizi_device_subscriptions
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant select, insert, update on public.frizi_conversations to authenticated;
grant select, insert, update on public.frizi_messages to authenticated;
grant select on public.frizi_message_deliveries to authenticated;
grant select, insert, update on public.frizi_campaigns to authenticated;
grant select, insert, update on public.frizi_campaign_audience_members to authenticated;
grant select, insert, update, delete on public.frizi_device_subscriptions to authenticated;

comment on table public.frizi_conversations is
  'Canonical one-to-one Frizi conversations between a professional and client.';
comment on table public.frizi_messages is
  'Canonical in-app-first Frizi messages. Email and push are delivery channels, not separate message systems.';
comment on table public.frizi_message_deliveries is
  'Per-channel delivery state for in-app, email, and push notifications.';
comment on table public.frizi_campaigns is
  'Professional campaign/audience records shared by CRM bulk actions and Promo sends.';
comment on table public.frizi_device_subscriptions is
  'Backend-ready web/native push subscription registry. Native push can be added without changing message ownership.';
