-- Canonical Frizi entitlement foundation.
-- Billing state, account plan, public profile state, and bookability are
-- intentionally separate. A paid Stripe subscription resolves to Pro Paid
-- capabilities, but Pro Free can still be published and basically bookable.

alter table public.frizi_professionals
  add column if not exists account_plan text not null default 'pro_free';

alter table public.frizi_professionals
  drop constraint if exists frizi_professionals_account_plan_check;

alter table public.frizi_professionals
  add constraint frizi_professionals_account_plan_check
  check (account_plan in ('pro_free', 'pro_paid'));

alter table public.frizi_salons
  add column if not exists account_plan text not null default 'salon_free';

alter table public.frizi_salons
  drop constraint if exists frizi_salons_account_plan_check;

alter table public.frizi_salons
  add constraint frizi_salons_account_plan_check
  check (account_plan in ('salon_free', 'salon', 'salon_pro'));

update public.frizi_professionals pro
set
  account_plan = 'pro_paid',
  updated_at = now()
where pro.account_plan <> 'pro_paid'
  and (
    pro.subscription_status in ('active', 'trialing')
    or exists (
      select 1
      from public.frizi_professional_subscriptions sub
      where sub.professional_id = pro.id
        and sub.status in ('active', 'trialing')
    )
  );

update public.frizi_professionals
set account_plan = 'pro_free'
where account_plan is null;

create or replace function public.frizi_professional_resolved_plan(target_professional_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  resolved_plan text;
begin
  select
    case
      when pro.account_plan = 'pro_paid'
        or pro.subscription_status in ('active', 'trialing')
        or exists (
          select 1
          from public.frizi_professional_subscriptions sub
          where sub.professional_id = pro.id
            and sub.status in ('active', 'trialing')
        )
        then 'pro_paid'
      else 'pro_free'
    end
  into resolved_plan
  from public.frizi_professionals pro
  where pro.id = target_professional_id;

  return coalesce(resolved_plan, 'pro_free');
end;
$$;

create or replace function public.frizi_professional_has_capability(target_professional_id uuid, capability text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  resolved_plan text;
  normalized_capability text := lower(coalesce(capability, ''));
begin
  resolved_plan := public.frizi_professional_resolved_plan(target_professional_id);

  if normalized_capability = any (array[
    'canpublishprofile',
    'canappearindiscovery',
    'canreceivebasicbookings',
    'canusebasicavailability',
    'canmanagebasiccalendar',
    'candisplayverifiedreviews',
    'canbesavedbyclients'
  ]) then
    return resolved_plan in ('pro_free', 'pro_paid');
  end if;

  if normalized_capability = any (array[
    'canuseadvancedservices',
    'canmessageclients',
    'canaccesscrm',
    'canaccessconnectedhairprofiles',
    'cancreatepromotions',
    'canrecommendproducts',
    'canprocesspayments',
    'canusedeposits',
    'cancreategiftcards',
    'cancreatepackages',
    'cancreatememberships',
    'canusemarketingautomation'
  ]) then
    return resolved_plan = 'pro_paid';
  end if;

  return false;
end;
$$;

create or replace function public.frizi_professional_has_capability(target_professional_id text, capability text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if target_professional_id is null
     or target_professional_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.frizi_professional_has_capability(target_professional_id::uuid, capability);
end;
$$;

create or replace function public.frizi_professional_is_publicly_bookable(target_professional_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  is_bookable boolean;
begin
  select exists (
    select 1
    from public.frizi_professionals pro
    where pro.id = target_professional_id
      and pro.public_profile_status = 'published'
      and pro.bookable = true
      and public.frizi_professional_has_active_account(pro.id)
      and public.frizi_professional_has_capability(pro.id, 'canReceiveBasicBookings')
  )
  into is_bookable;

  return coalesce(is_bookable, false);
end;
$$;

create or replace function public.frizi_professional_is_publicly_bookable(target_professional_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if target_professional_id is null
     or target_professional_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.frizi_professional_is_publicly_bookable(target_professional_id::uuid);
end;
$$;

drop policy if exists "published professional profiles are public readable" on public.frizi_professionals;
create policy "published professional profiles are public readable"
on public.frizi_professionals
for select
to anon, authenticated
using (public.frizi_professional_is_publicly_bookable(id));

drop policy if exists "active public appointment promotions are readable" on public.frizi_promotions;
create policy "active public appointment promotions are readable"
on public.frizi_promotions
for select
to anon, authenticated
using (
  active = true
  and show_on_profile = true
  and is_featured_profile_offer = true
  and (start_at is null or start_at <= now())
  and (end_at is null or end_at >= now())
  and exists (
    select 1
    from public.frizi_professionals pro
    where pro.id::text = frizi_promotions.created_by
      and public.frizi_professional_is_publicly_bookable(pro.id)
      and public.frizi_professional_has_capability(pro.id, 'canCreatePromotions')
  )
);

drop policy if exists "professionals can create own promotions" on public.frizi_promotions;
create policy "professionals can create own promotions"
on public.frizi_promotions
for insert
to authenticated
with check (
  salon_id is null
  and public.frizi_is_current_professional(created_by)
  and public.frizi_professional_has_capability(created_by, 'canCreatePromotions')
);

drop policy if exists "professionals can update own promotions" on public.frizi_promotions;
create policy "professionals can update own promotions"
on public.frizi_promotions
for update
to authenticated
using (
  salon_id is null
  and public.frizi_is_current_professional(created_by)
  and public.frizi_professional_has_capability(created_by, 'canCreatePromotions')
)
with check (
  salon_id is null
  and public.frizi_is_current_professional(created_by)
  and public.frizi_professional_has_capability(created_by, 'canCreatePromotions')
);

drop policy if exists "professionals can create conversations for their CRM clients" on public.frizi_conversations;
create policy "professionals can create conversations for their CRM clients"
on public.frizi_conversations
for insert
to authenticated
with check (
  professional_id = public.frizi_current_professional_id()
  and public.frizi_professional_has_capability(professional_id, 'canMessageClients')
  and exists (
    select 1 from public.frizi_client_professional_relationships rel
    where rel.professional_id = frizi_conversations.professional_id
      and rel.client_id = frizi_conversations.client_id
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
      and public.frizi_professional_has_capability(c.professional_id, 'canMessageClients')
      and (
        (frizi_messages.sender_role = 'professional' and c.professional_id = public.frizi_current_professional_id())
        or (frizi_messages.sender_role = 'client' and c.client_id = public.frizi_current_client_id())
      )
  )
);

revoke all on function public.frizi_professional_resolved_plan(uuid) from public;
revoke all on function public.frizi_professional_has_capability(uuid, text) from public;
revoke all on function public.frizi_professional_has_capability(text, text) from public;
revoke all on function public.frizi_professional_is_publicly_bookable(uuid) from public;
revoke all on function public.frizi_professional_is_publicly_bookable(text) from public;

grant execute on function public.frizi_professional_resolved_plan(uuid) to authenticated;
grant execute on function public.frizi_professional_has_capability(uuid, text) to anon, authenticated;
grant execute on function public.frizi_professional_has_capability(text, text) to anon, authenticated;
grant execute on function public.frizi_professional_is_publicly_bookable(uuid) to anon, authenticated;
grant execute on function public.frizi_professional_is_publicly_bookable(text) to anon, authenticated;

comment on column public.frizi_professionals.account_plan is
  'Canonical professional entitlement plan. Billing state may imply pro_paid capabilities, but publication/bookability are evaluated separately.';

comment on column public.frizi_salons.account_plan is
  'Canonical salon entitlement plan foundation: salon_free, salon, salon_pro.';

comment on function public.frizi_professional_has_capability(uuid, text) is
  'Canonical server-side professional capability resolver used by RLS and application APIs.';
