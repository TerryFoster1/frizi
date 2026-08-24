-- Phase 13: Salon website booking and team widgets.
-- Widgets expose only explicitly configured public data and require an active
-- widget token plus an allowed embedding domain.

create table if not exists public.frizi_salon_widget_configs (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.frizi_salons(id) on delete cascade,
  location_id uuid references public.frizi_salon_locations(id) on delete set null,
  widget_type text not null check (widget_type in ('booking', 'team_directory', 'book_now', 'reviews', 'gift_cards')),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  public_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  allowed_domains text[] not null default '{}',
  theme_config jsonb not null default '{}'::jsonb,
  widget_config jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.frizi_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists frizi_salon_widget_configs_salon_type_idx
  on public.frizi_salon_widget_configs (salon_id, widget_type, status);

alter table public.frizi_salon_widget_configs enable row level security;

drop policy if exists "salon managers can manage website widgets" on public.frizi_salon_widget_configs;
create policy "salon managers can manage website widgets"
on public.frizi_salon_widget_configs
for all
to authenticated
using (public.frizi_is_salon_member(salon_id, array['owner','manager']))
with check (public.frizi_is_salon_member(salon_id, array['owner','manager']));

create or replace function public.frizi_get_salon_widget_public(
  target_public_token text,
  request_origin_host text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  widget_row public.frizi_salon_widget_configs%rowtype;
  salon_row public.frizi_salons%rowtype;
  normalized_origin text := lower(trim(coalesce(request_origin_host, '')));
  staff_payload jsonb;
  service_payload jsonb;
begin
  select *
  into widget_row
  from public.frizi_salon_widget_configs
  where public_token = target_public_token
    and status = 'active';

  if widget_row.id is null then
    raise exception 'Widget was not found';
  end if;

  if array_length(widget_row.allowed_domains, 1) is null then
    raise exception 'Widget domain is not allowed';
  end if;

  if not exists (
    select 1
    from unnest(widget_row.allowed_domains) allowed_domain
    where lower(trim(allowed_domain)) = normalized_origin
  ) then
    raise exception 'Widget domain is not allowed';
  end if;

  select *
  into salon_row
  from public.frizi_salons
  where id = widget_row.salon_id
    and status = 'active';

  if salon_row.id is null then
    raise exception 'Salon is not available';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'staffAssignmentId', assignment.id,
    'professionalId', assignment.professional_id,
    'name', assignment.display_name,
    'title', assignment.professional_title,
    'specialties', assignment.specialties,
    'chairLabel', assignment.chair_label,
    'upgradeStatus', assignment.pro_upgrade_status
  ) order by assignment.display_name), '[]'::jsonb)
  into staff_payload
  from public.frizi_salon_staff_assignments assignment
  where assignment.salon_id = widget_row.salon_id
    and assignment.employment_status = 'active';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', service.id,
    'professionalId', service.professional_id,
    'name', service.name,
    'description', service.public_description,
    'priceCents', service.base_price_cents,
    'currency', service.currency,
    'durationMinutes', service.duration_minutes
  ) order by service.name), '[]'::jsonb)
  into service_payload
  from public.frizi_services service
  where service.active = true
    and exists (
      select 1
      from public.frizi_salon_staff_assignments assignment
      where assignment.salon_id = widget_row.salon_id
        and assignment.employment_status = 'active'
        and assignment.professional_id::text = service.professional_id
    );

  return jsonb_build_object(
    'widgetId', widget_row.id,
    'widgetType', widget_row.widget_type,
    'salonId', widget_row.salon_id,
    'salonName', salon_row.name,
    'locationId', widget_row.location_id,
    'theme', widget_row.theme_config,
    'config', widget_row.widget_config,
    'staff', staff_payload,
    'services', service_payload,
    'flow', jsonb_build_array('What are you looking for?', 'When?', 'Who would you like?')
  );
end;
$$;

revoke all on function public.frizi_get_salon_widget_public(text, text) from public;
grant execute on function public.frizi_get_salon_widget_public(text, text) to anon, authenticated;

grant select, insert, update on public.frizi_salon_widget_configs to authenticated;

comment on table public.frizi_salon_widget_configs is
  'Embeddable Salon booking/team/reviews/gift widgets. Public access must go through token and domain validation.';

comment on function public.frizi_get_salon_widget_public(text, text) is
  'Safe public Salon widget payload. Returns only public widget data after active-token and allowed-domain validation.';
