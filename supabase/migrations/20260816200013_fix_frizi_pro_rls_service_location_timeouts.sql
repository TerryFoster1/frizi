-- Fix recursive RLS evaluation that caused Frizi Pro service/location reads to time out.
-- The public professional policies call frizi_professional_has_active_account(id).
-- As SECURITY INVOKER, that helper re-entered frizi_professionals RLS and recursively called itself.

create or replace function public.frizi_professional_has_active_account(target_professional_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  has_account boolean;
begin
  select exists (
    select 1
    from public.frizi_professionals pro
    join public.frizi_profiles profile on profile.id = pro.profile_id
    where pro.id = target_professional_id
      and profile.status = 'active'
      and profile.account_type = 'professional'
      and profile.auth_user_id is not null
  )
  into has_account;

  return coalesce(has_account, false);
end;
$$;

revoke all on function public.frizi_professional_has_active_account(uuid) from public;
grant execute on function public.frizi_professional_has_active_account(uuid) to anon, authenticated;

create index if not exists frizi_services_professional_display_idx
  on public.frizi_services (professional_id, display_order);

create index if not exists frizi_services_public_discovery_idx
  on public.frizi_services (professional_id, display_order)
  where active = true and online_booking_enabled = true;

create index if not exists frizi_service_addons_professional_idx
  on public.frizi_service_addons (professional_id, service_id, display_order);

create index if not exists frizi_professional_locations_professional_active_updated_idx
  on public.frizi_professional_locations (professional_id, active, primary_location desc, updated_at desc);

comment on function public.frizi_professional_has_active_account(uuid) is
  'RLS-safe account existence check used by public professional discovery policies. SECURITY DEFINER avoids recursive frizi_professionals policy evaluation while returning only a boolean.';
