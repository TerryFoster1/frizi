-- Fail closed when no concrete Salon id is supplied.
-- The plan resolver may default unknown plan values to salon_free for existing
-- salon rows, but capability checks must never grant access for NULL ids.

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
  if target_salon_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.frizi_salons salon
    where salon.id = target_salon_id
      and salon.status in ('active', 'draft')
  ) then
    return false;
  end if;

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

revoke all on function public.frizi_salon_has_capability(uuid, text) from public;
grant execute on function public.frizi_salon_has_capability(uuid, text) to authenticated;

comment on function public.frizi_salon_has_capability(uuid, text) is
  'Canonical server-side Salon capability resolver. Returns false when no concrete active/draft salon id is supplied.';
