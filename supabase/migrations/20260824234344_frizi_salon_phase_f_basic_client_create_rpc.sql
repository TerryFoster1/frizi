-- Phase F: create basic Salon booking contacts without granting direct
-- frizi_clients row visibility. Returns only the inserted client id.

create or replace function public.frizi_create_salon_booking_client(
  target_salon_id uuid,
  client_name text,
  client_email text default null,
  client_phone text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  new_client_id uuid;
begin
  if target_salon_id is null then
    raise exception 'Salon is required.' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(client_name, '')), '') is null then
    raise exception 'Client name is required.' using errcode = '22023';
  end if;

  if not (
    public.frizi_salon_has_capability(target_salon_id, 'canUseBasicClientDirectory')
    and public.frizi_is_salon_member(target_salon_id, array['owner', 'manager', 'reception'])
  ) then
    raise exception 'You do not have permission to create booking contacts for this salon.' using errcode = '42501';
  end if;

  insert into public.frizi_clients (
    preferred_name,
    first_name,
    email,
    phone,
    created_by_salon_id
  )
  values (
    btrim(client_name),
    btrim(client_name),
    nullif(btrim(coalesce(client_email, '')), ''),
    nullif(btrim(coalesce(client_phone, '')), ''),
    target_salon_id
  )
  returning id into new_client_id;

  return new_client_id;
end;
$$;

revoke all on function public.frizi_create_salon_booking_client(uuid, text, text, text) from public;
grant execute on function public.frizi_create_salon_booking_client(uuid, text, text, text) to authenticated;

comment on function public.frizi_create_salon_booking_client(uuid, text, text, text) is
  'Creates a Salon-owned basic booking contact after membership/capability checks and returns only the client id.';
