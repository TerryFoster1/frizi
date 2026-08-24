-- Frizi Salon Phase B entitlement capabilities.
-- Salon Free is useful for manual operations. Paid Salon tiers unlock
-- automation, connected team access, client communication, commerce, and
-- growth features. Keep this resolver as the canonical server-side contract
-- for Salon capability checks.

create or replace function public.frizi_salon_resolved_plan(target_salon_id uuid)
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
      when salon.account_plan in ('salon', 'salon_pro') then salon.account_plan
      else 'salon_free'
    end
  into resolved_plan
  from public.frizi_salons salon
  where salon.id = target_salon_id
    and salon.status in ('active', 'draft');

  return coalesce(resolved_plan, 'salon_free');
end;
$$;

create or replace function public.frizi_salon_has_capability(
  target_salon_id uuid,
  capability text
)
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
  resolved_plan := public.frizi_salon_resolved_plan(target_salon_id);

  if normalized_capability = any (array[
    'canusemanualcalendar',
    'canmanagecalendarstaff',
    'canusebasicappointments',
    'canusebasicwalkins',
    'canusebasicbookingcontacts',
    'canusebasichistory',
    'canmanagebasichours',
    'canuseadminalwaysavailable'
  ]) then
    return resolved_plan in ('salon_free', 'salon', 'salon_pro');
  end if;

  if normalized_capability = any (array[
    'canuseconnectedstaffaccounts',
    'canusewebsitebooking',
    'canusesaloncrm',
    'canusemessaging',
    'canusepayments',
    'canusedeposits',
    'canusepromotions',
    'canusereviewsdiscovery',
    'canusegiftcards',
    'canusepackages',
    'canusememberships',
    'canusereports',
    'canusestructuredservices'
  ]) then
    return resolved_plan in ('salon', 'salon_pro');
  end if;

  if normalized_capability = any (array[
    'canuseproducts',
    'canuseinventory',
    'canuseadvancedmarketing',
    'canuseadvancedreporting',
    'canusestaffperformance',
    'canuseadvancedpermissions',
    'canusetimeclock',
    'canusecommissioninputs',
    'canusebusinessoptimization',
    'canusemultilocationadvanced'
  ]) then
    return resolved_plan = 'salon_pro';
  end if;

  return false;
end;
$$;

create or replace function public.frizi_salon_has_capability(
  target_salon_id text,
  capability text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if target_salon_id is null
     or target_salon_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.frizi_salon_has_capability(target_salon_id::uuid, capability);
end;
$$;

revoke all on function public.frizi_salon_resolved_plan(uuid) from public;
revoke all on function public.frizi_salon_has_capability(uuid, text) from public;
revoke all on function public.frizi_salon_has_capability(text, text) from public;

grant execute on function public.frizi_salon_resolved_plan(uuid) to authenticated;
grant execute on function public.frizi_salon_has_capability(uuid, text) to authenticated;
grant execute on function public.frizi_salon_has_capability(text, text) to authenticated;

comment on function public.frizi_salon_resolved_plan(uuid) is
  'Canonical Salon plan resolver. Defaults to salon_free unless the salon account_plan is salon or salon_pro.';

comment on function public.frizi_salon_has_capability(uuid, text) is
  'Canonical server-side Salon capability resolver for Free, Salon, and Salon Pro feature gates.';
