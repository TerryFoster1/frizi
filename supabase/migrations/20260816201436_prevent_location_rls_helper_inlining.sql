-- The service/location RLS helpers must not be inlined into caller queries.
-- PL/pgSQL SECURITY DEFINER functions keep the table lookups inside the
-- definer-owned function boundary and avoid recursive RLS expansion when the
-- helper is evaluated against table columns.

create or replace function public.frizi_is_current_professional(target_professional_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  owns_professional boolean;
begin
  select exists (
    select 1
    from public.frizi_professionals pro
    join public.frizi_profiles profile on profile.id = pro.profile_id
    where pro.id = target_professional_id
      and profile.auth_user_id = (select auth.uid())
      and profile.status = 'active'
      and profile.account_type = 'professional'
  )
  into owns_professional;

  return coalesce(owns_professional, false);
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
      and pro.subscription_status in ('active', 'trialing')
      and public.frizi_professional_has_active_account(pro.id)
  )
  into is_bookable;

  return coalesce(is_bookable, false);
end;
$$;

revoke all on function public.frizi_is_current_professional(uuid) from public;
revoke all on function public.frizi_professional_is_publicly_bookable(uuid) from public;

grant execute on function public.frizi_is_current_professional(uuid) to authenticated;
grant execute on function public.frizi_professional_is_publicly_bookable(uuid) to anon, authenticated;
