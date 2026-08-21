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
