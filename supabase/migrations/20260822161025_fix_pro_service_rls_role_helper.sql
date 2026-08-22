-- Frizi Pro ownership is now role-based. A user can have a client profile row
-- plus an active professional role, so service/location RLS must not depend on
-- the legacy single-value frizi_profiles.account_type field.

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
      and (
        profile.account_type = 'professional'
        or exists (
          select 1
          from public.frizi_user_roles role_row
          where role_row.profile_id = profile.id
            and role_row.role = 'professional'
            and role_row.status = 'active'
            and role_row.revoked_at is null
        )
      )
  )
  into owns_professional;

  return coalesce(owns_professional, false);
end;
$$;

revoke all on function public.frizi_is_current_professional(uuid) from public;
grant execute on function public.frizi_is_current_professional(uuid) to authenticated;

comment on function public.frizi_is_current_professional(uuid) is
  'RLS-safe ownership check for professional-owned tables. Supports active professional roles on shared client/pro profiles.';
