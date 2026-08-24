-- Phase 9: Salon lifecycle marketing and automation foundation.
-- Extends the existing Frizi promotions/campaigns/messaging model instead of
-- creating a separate Salon-only marketing system.

alter table public.frizi_promotions
  add column if not exists salon_id uuid references public.frizi_salons(id) on delete cascade,
  add column if not exists salon_location_id uuid references public.frizi_salon_locations(id) on delete set null,
  add column if not exists promotion_scope text not null default 'professional'
    check (promotion_scope in ('professional', 'salon')),
  add column if not exists created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  add column if not exists audience_strategy jsonb not null default '{}'::jsonb;

alter table public.frizi_campaigns
  alter column professional_id drop not null,
  add column if not exists salon_id uuid references public.frizi_salons(id) on delete cascade,
  add column if not exists salon_location_id uuid references public.frizi_salon_locations(id) on delete set null,
  add column if not exists campaign_scope text not null default 'professional'
    check (campaign_scope in ('professional', 'salon')),
  add column if not exists content_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists channel_preferences text[] not null default array['in_app']::text[],
  add column if not exists scheduled_for timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists created_by_profile_id uuid references public.frizi_profiles(id) on delete set null;

alter table public.frizi_campaign_audience_members
  alter column relationship_id drop not null,
  add column if not exists salon_id uuid references public.frizi_salons(id) on delete cascade,
  add column if not exists salon_relationship_id uuid references public.frizi_salon_client_relationships(id) on delete cascade,
  add column if not exists audience_reason text,
  add column if not exists consent_status_snapshot text,
  add column if not exists channel_preferences_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists delivery_status text not null default 'queued'
    check (delivery_status in ('queued', 'sent', 'skipped', 'failed'));

alter table public.frizi_salon_client_relationships
  add column if not exists marketing_consent_status text not null default 'unknown',
  add column if not exists marketing_channel_preferences jsonb not null default jsonb_build_object(
    'in_app', true,
    'email', false,
    'push', false
  );

create table if not exists public.frizi_salon_automation_rules (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  salon_location_id uuid references public.frizi_salon_locations(id) on delete set null,
  name text not null,
  automation_type text not null check (
    automation_type in (
      'birthday',
      'lapsed_client',
      'rebooking_reminder',
      'post_appointment_follow_up',
      'review_request',
      'product_replenishment_reminder',
      'waitlist_opening',
      'membership_opportunity'
    )
  ),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  audience_filters jsonb not null default '{}'::jsonb,
  message_template jsonb not null default '{}'::jsonb,
  channel_preferences text[] not null default array['in_app']::text[],
  cadence_days integer check (cadence_days is null or cadence_days > 0),
  service_id text references public.frizi_services(id) on delete set null,
  product_variant_id text references public.frizi_commerce_product_variants(id) on delete set null,
  trigger_offset_days integer not null default 0,
  require_marketing_consent boolean not null default true,
  created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frizi_salon_automation_events (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.frizi_salon_automation_rules(id) on delete cascade,
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  client_id uuid references public.frizi_clients(id) on delete cascade,
  salon_relationship_id uuid references public.frizi_salon_client_relationships(id) on delete set null,
  appointment_id uuid references public.frizi_appointments(id) on delete set null,
  inventory_item_id uuid references public.frizi_salon_inventory_items(id) on delete set null,
  event_type text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'blocked', 'sent', 'skipped', 'cancelled', 'failed')),
  blocked_reason text,
  consent_status_snapshot text,
  channel_preferences_snapshot jsonb not null default '{}'::jsonb,
  message_id uuid references public.frizi_messages(id) on delete set null,
  notification_id uuid references public.frizi_notifications(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists frizi_promotions_salon_scope_idx
  on public.frizi_promotions (salon_id, active, updated_at desc)
  where salon_id is not null;

create index if not exists frizi_campaigns_salon_idx
  on public.frizi_campaigns (salon_id, status, updated_at desc)
  where salon_id is not null;

create index if not exists frizi_campaign_audience_members_salon_idx
  on public.frizi_campaign_audience_members (salon_id, campaign_id, status)
  where salon_id is not null;

create unique index if not exists frizi_campaign_audience_members_salon_relationship_idx
  on public.frizi_campaign_audience_members (campaign_id, salon_relationship_id)
  where salon_relationship_id is not null;

create index if not exists frizi_salon_automation_rules_salon_status_idx
  on public.frizi_salon_automation_rules (salon_id, status, automation_type);

create index if not exists frizi_salon_automation_events_salon_status_idx
  on public.frizi_salon_automation_events (salon_id, status, scheduled_for);

create or replace function public.frizi_allows_promotional_contact(
  consent_status text,
  notification_preferences jsonb
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select lower(coalesce(consent_status, 'unknown')) in ('granted', 'opted_in', 'subscribed')
    and coalesce((notification_preferences ->> 'promotional_notifications_enabled')::boolean, false) = true;
$$;

create or replace function public.frizi_build_salon_campaign_audience(target_campaign_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_row public.frizi_campaigns%rowtype;
  filter_tags text[] := '{}'::text[];
  filter_statuses text[] := '{}'::text[];
  selected_count integer := 0;
begin
  select *
  into campaign_row
  from public.frizi_campaigns
  where id = target_campaign_id
    and campaign_scope = 'salon'
    and salon_id is not null;

  if campaign_row.id is null then
    raise exception 'Salon campaign not found';
  end if;

  if not public.frizi_is_salon_member(campaign_row.salon_id, array['owner', 'manager', 'reception']) then
    raise exception 'Not authorized to build this campaign audience';
  end if;

  select coalesce(array_agg(value), '{}'::text[])
  into filter_tags
  from jsonb_array_elements_text(coalesce(campaign_row.audience_filters -> 'tags', '[]'::jsonb)) as tag_values(value);

  select coalesce(array_agg(value), '{}'::text[])
  into filter_statuses
  from jsonb_array_elements_text(coalesce(campaign_row.audience_filters -> 'relationship_statuses', '[]'::jsonb)) as status_values(value);

  delete from public.frizi_campaign_audience_members
  where campaign_id = target_campaign_id
    and salon_id = campaign_row.salon_id
    and status = 'pending';

  insert into public.frizi_campaign_audience_members (
    campaign_id,
    salon_id,
    salon_relationship_id,
    client_id,
    status,
    delivery_status,
    audience_reason,
    consent_status_snapshot,
    channel_preferences_snapshot
  )
  select
    campaign_row.id,
    relationship.salon_id,
    relationship.id,
    relationship.client_id,
    'pending',
    'queued',
    case
      when campaign_row.audience_type = 'selected_clients' then 'selected_client'
      when cardinality(filter_tags) > 0 then 'tag_match'
      when cardinality(filter_statuses) > 0 then 'relationship_status_match'
      else 'salon_crm_match'
    end,
    client_record.marketing_consent_status,
    client_record.notification_preferences
  from public.frizi_salon_client_relationships relationship
  join public.frizi_clients client_record
    on client_record.id = relationship.client_id
  where relationship.salon_id = campaign_row.salon_id
    and relationship.relationship_status in ('active', 'prospect', 'lapsed')
    and (
      campaign_row.salon_location_id is null
      or relationship.preferred_professional_id is null
      or exists (
        select 1
        from public.frizi_salon_staff_assignments assignment
        where assignment.salon_id = relationship.salon_id
          and assignment.professional_id = relationship.preferred_professional_id
          and assignment.location_id = campaign_row.salon_location_id
          and assignment.employment_status = 'active'
      )
    )
    and (
      campaign_row.audience_type <> 'selected_clients'
      or relationship.client_id = any(campaign_row.selected_client_ids)
    )
    and (
      cardinality(filter_tags) = 0
      or relationship.tags && filter_tags
    )
    and (
      cardinality(filter_statuses) = 0
      or relationship.relationship_status = any(filter_statuses)
    )
    and public.frizi_allows_promotional_contact(relationship.marketing_consent_status, client_record.notification_preferences)
  on conflict (campaign_id, salon_relationship_id) where salon_relationship_id is not null
  do update set
    client_id = excluded.client_id,
    consent_status_snapshot = excluded.consent_status_snapshot,
    channel_preferences_snapshot = excluded.channel_preferences_snapshot,
    updated_at = now();

  get diagnostics selected_count = row_count;
  return selected_count;
end;
$$;

alter table public.frizi_salon_automation_rules enable row level security;
alter table public.frizi_salon_automation_events enable row level security;

drop policy if exists "salon members can read salon promotions" on public.frizi_promotions;
create policy "salon members can read salon promotions"
on public.frizi_promotions
for select
to authenticated
using (salon_id is not null and public.frizi_is_salon_member(salon_id));

drop policy if exists "salon managers can create salon promotions" on public.frizi_promotions;
create policy "salon managers can create salon promotions"
on public.frizi_promotions
for insert
to authenticated
with check (salon_id is not null and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon managers can update salon promotions" on public.frizi_promotions;
create policy "salon managers can update salon promotions"
on public.frizi_promotions
for update
to authenticated
using (salon_id is not null and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (salon_id is not null and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon members can read salon campaigns" on public.frizi_campaigns;
create policy "salon members can read salon campaigns"
on public.frizi_campaigns
for select
to authenticated
using (salon_id is not null and public.frizi_is_salon_member(salon_id));

drop policy if exists "salon managers can create salon campaigns" on public.frizi_campaigns;
create policy "salon managers can create salon campaigns"
on public.frizi_campaigns
for insert
to authenticated
with check (salon_id is not null and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon managers can update salon campaigns" on public.frizi_campaigns;
create policy "salon managers can update salon campaigns"
on public.frizi_campaigns
for update
to authenticated
using (salon_id is not null and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (salon_id is not null and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon members can read salon campaign audiences" on public.frizi_campaign_audience_members;
create policy "salon members can read salon campaign audiences"
on public.frizi_campaign_audience_members
for select
to authenticated
using (salon_id is not null and public.frizi_is_salon_member(salon_id));

drop policy if exists "salon managers can create salon campaign audiences" on public.frizi_campaign_audience_members;
create policy "salon managers can create salon campaign audiences"
on public.frizi_campaign_audience_members
for insert
to authenticated
with check (salon_id is not null and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon managers can update salon campaign audiences" on public.frizi_campaign_audience_members;
create policy "salon managers can update salon campaign audiences"
on public.frizi_campaign_audience_members
for update
to authenticated
using (salon_id is not null and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (salon_id is not null and public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon members can read automation rules" on public.frizi_salon_automation_rules;
create policy "salon members can read automation rules"
on public.frizi_salon_automation_rules
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "salon managers can create automation rules" on public.frizi_salon_automation_rules;
create policy "salon managers can create automation rules"
on public.frizi_salon_automation_rules
for insert
to authenticated
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon managers can update automation rules" on public.frizi_salon_automation_rules;
create policy "salon managers can update automation rules"
on public.frizi_salon_automation_rules
for update
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon managers can delete automation rules" on public.frizi_salon_automation_rules;
create policy "salon managers can delete automation rules"
on public.frizi_salon_automation_rules
for delete
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon members can read automation events" on public.frizi_salon_automation_events;
create policy "salon members can read automation events"
on public.frizi_salon_automation_events
for select
to authenticated
using (public.frizi_is_salon_member(salon_id));

drop policy if exists "salon managers can create automation events" on public.frizi_salon_automation_events;
create policy "salon managers can create automation events"
on public.frizi_salon_automation_events
for insert
to authenticated
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

drop policy if exists "salon managers can update automation events" on public.frizi_salon_automation_events;
create policy "salon managers can update automation events"
on public.frizi_salon_automation_events
for update
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']))
with check (public.frizi_is_salon_member(salon_id, array['owner', 'manager', 'reception']));

revoke all on function public.frizi_build_salon_campaign_audience(uuid) from public;
grant execute on function public.frizi_build_salon_campaign_audience(uuid) to authenticated;

grant select, insert, update on public.frizi_promotions to authenticated;
grant select, insert, update on public.frizi_campaigns to authenticated;
grant select, insert, update on public.frizi_campaign_audience_members to authenticated;
grant select, insert, update, delete on public.frizi_salon_automation_rules to authenticated;
grant select, insert, update on public.frizi_salon_automation_events to authenticated;

comment on column public.frizi_campaigns.campaign_scope is
  'Scopes campaigns to existing individual professionals or a Salon organization. Salon campaigns still use canonical Frizi client/message/promo concepts.';

comment on table public.frizi_salon_automation_rules is
  'Rule-based Salon lifecycle automation definitions such as birthdays, lapsed clients, rebooking reminders, follow-ups, reviews, replenishment, and waitlist openings. This is not AI prediction.';

comment on column public.frizi_salon_automation_rules.require_marketing_consent is
  'When true, marketing/promo automations must respect client promotional consent and channel preferences before sending.';

comment on table public.frizi_salon_automation_events is
  'Scheduled or processed automation instances. Events keep consent/channel snapshots for auditability without exposing technical suppression language in the Salon UI.';
