create or replace function public.frizi_professional_has_active_account(target_professional_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  has_account boolean;
begin
  select exists (
    select 1
    from public.frizi_professionals pro
    join public.frizi_profiles profile on profile.id = pro.profile_id
    join auth.users auth_user on auth_user.id = profile.auth_user_id
    where pro.id = target_professional_id
      and profile.status = 'active'
      and profile.account_type = 'professional'
      and profile.auth_user_id is not null
  )
  into has_account;

  return coalesce(has_account, false);
end;
$function$;

comment on function public.frizi_professional_has_active_account(uuid) is
  'Fail-closed public discovery guard: a professional is account-backed only when the linked active professional profile still has a matching Supabase Auth user.';
