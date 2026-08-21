create or replace function public.frizi_current_professional_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pro.id
  from public.frizi_professionals pro
  join public.frizi_profiles profile on profile.id = pro.profile_id
  where profile.auth_user_id = (select auth.uid())
  limit 1
$$;

create or replace function public.frizi_current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.frizi_clients c
  join public.frizi_profiles p on p.id = c.profile_id
  where p.auth_user_id = (select auth.uid())
  limit 1
$$;
