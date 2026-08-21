begin;

create temporary table frizi_rls_negative_results (
  test_name text primary key,
  evidence jsonb not null
) on commit drop;

grant insert, select on frizi_rls_negative_results to authenticated;

insert into public.frizi_profiles (id, auth_user_id, account_type, display_name, email, status)
values
  ('90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000101', 'professional', 'RLS Pro A', 'rls-pro-a@example.invalid', 'active'),
  ('90000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000102', 'professional', 'RLS Pro B', 'rls-pro-b@example.invalid', 'active'),
  ('90000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000201', 'client', 'RLS Client A', 'rls-client-a@example.invalid', 'active'),
  ('90000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000202', 'client', 'RLS Client B', 'rls-client-b@example.invalid', 'active');

insert into public.frizi_professionals (id, profile_id, public_slug, display_name, studio_name, specialties, services, location, booking_settings, public_profile_status, onboarding_status, subscription_status, bookable)
values
  ('90000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000001', 'rls-pro-a', 'RLS Pro A', 'RLS Studio A', array['Cuts'], '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 'draft', 'profile_saved', 'no_subscription', false),
  ('90000000-0000-4000-8000-000000000012', '90000000-0000-4000-8000-000000000002', 'rls-pro-b', 'RLS Pro B', 'RLS Studio B', array['Color'], '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 'draft', 'profile_saved', 'no_subscription', false);

insert into public.frizi_professional_locations (id, professional_id, address_line_1, city, province, postal_code, country, primary_location, active)
values
  ('90000000-0000-4000-8000-000000000021', '90000000-0000-4000-8000-000000000011', '1 A St', 'Toronto', 'ON', 'M5V 1A1', 'CA', true, true),
  ('90000000-0000-4000-8000-000000000022', '90000000-0000-4000-8000-000000000012', '2 B St', 'Toronto', 'ON', 'M5V 1B1', 'CA', true, true);

insert into public.frizi_services (id, professional_id, name, base_price_cents, currency, taxable, tip_eligible, promotion_eligible, active, category, pricing_type, deposit_type, deposit_amount_cents, deposit_percentage, buffer_before_minutes, buffer_after_minutes, online_booking_enabled, new_clients_allowed, existing_clients_only, display_order, service_metadata)
values
  ('rls_service_a', '90000000-0000-4000-8000-000000000011', 'RLS Service A', 5000, 'cad', true, true, true, true, 'Haircut', 'fixed', 'none', 0, 0, 0, 0, true, true, false, 1, '{}'::jsonb),
  ('rls_service_b', '90000000-0000-4000-8000-000000000012', 'RLS Service B', 6000, 'cad', true, true, true, true, 'Haircut', 'fixed', 'none', 0, 0, 0, 0, true, true, false, 1, '{}'::jsonb);

insert into public.frizi_clients (id, profile_id, preferred_name, hair_profile, preferences, communication_preferences, privacy_settings)
values
  ('90000000-0000-4000-8000-000000000031', '90000000-0000-4000-8000-000000000003', 'RLS Client A', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('90000000-0000-4000-8000-000000000032', '90000000-0000-4000-8000-000000000004', 'RLS Client B', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb);

insert into public.frizi_client_professional_relationships (id, client_id, professional_id, status, source, professional_private_notes, tags, preferred_services, marketing_consent_status, account_claimed_status)
values
  ('90000000-0000-4000-8000-000000000041', '90000000-0000-4000-8000-000000000031', '90000000-0000-4000-8000-000000000011', 'active', 'booking', 'private notes A', array['a'], array[]::text[], 'unknown', 'claimed'),
  ('90000000-0000-4000-8000-000000000042', '90000000-0000-4000-8000-000000000032', '90000000-0000-4000-8000-000000000012', 'active', 'booking', 'private notes B', array['b'], array[]::text[], 'unknown', 'claimed');

insert into public.frizi_professional_invites (id, professional_id, token, status, source)
values
  ('90000000-0000-4000-8000-000000000051', '90000000-0000-4000-8000-000000000011', 'rls_invite_token_a_123', 'active', 'qr'),
  ('90000000-0000-4000-8000-000000000052', '90000000-0000-4000-8000-000000000012', 'rls_invite_token_b_123', 'active', 'qr');

insert into public.frizi_appointments (id, client_id, professional_id, service_id, service_snapshot, starts_at, ends_at, status, payment_status, booking_source, reference_photo_urls, payment_requirement, payment_required_cents)
values
  ('90000000-0000-4000-8000-000000000061', '90000000-0000-4000-8000-000000000031', '90000000-0000-4000-8000-000000000011', 'rls_service_a', '{"name":"RLS Service A"}'::jsonb, '2026-09-01T10:00:00Z', '2026-09-01T10:30:00Z', 'pending', 'not_required', 'client_app', array[]::text[], 'pay_at_appointment', 0),
  ('90000000-0000-4000-8000-000000000062', '90000000-0000-4000-8000-000000000032', '90000000-0000-4000-8000-000000000012', 'rls_service_b', '{"name":"RLS Service B"}'::jsonb, '2026-09-01T11:00:00Z', '2026-09-01T11:30:00Z', 'pending', 'not_required', 'client_app', array[]::text[], 'pay_at_appointment', 0);

insert into public.frizi_client_passport_tokens (id, client_id, token, status)
values
  ('90000000-0000-4000-8000-000000000071', '90000000-0000-4000-8000-000000000031', 'rls_passport_token_a_123456789', 'active'),
  ('90000000-0000-4000-8000-000000000072', '90000000-0000-4000-8000-000000000032', 'rls_passport_token_b_123456789', 'active');

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000101';

with denied_update as (
  update public.frizi_services
  set base_price_cents = 9999
  where id = 'rls_service_b'
  returning id
)
insert into frizi_rls_negative_results (test_name, evidence)
select
  'professional_a_negative_rls',
  jsonb_build_object(
    'own_profile_visible', (select count(*) from public.frizi_professionals where id = '90000000-0000-4000-8000-000000000011'),
    'other_private_profile_visible', (select count(*) from public.frizi_professionals where id = '90000000-0000-4000-8000-000000000012'),
    'own_service_visible', (select count(*) from public.frizi_services where id = 'rls_service_a'),
    'other_service_visible', (select count(*) from public.frizi_services where id = 'rls_service_b'),
    'other_location_visible', (select count(*) from public.frizi_professional_locations where professional_id = '90000000-0000-4000-8000-000000000012'),
    'other_crm_visible', (select count(*) from public.frizi_client_professional_relationships where id = '90000000-0000-4000-8000-000000000042'),
    'other_invite_visible', (select count(*) from public.frizi_professional_invites where professional_id = '90000000-0000-4000-8000-000000000012'),
    'other_appointment_visible', (select count(*) from public.frizi_appointments where id = '90000000-0000-4000-8000-000000000062'),
    'other_service_update_count', (select count(*) from denied_update)
  );

set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000201';

insert into frizi_rls_negative_results (test_name, evidence)
select
  'client_a_negative_rls',
  jsonb_build_object(
    'own_client_visible', (select count(*) from public.frizi_clients where id = '90000000-0000-4000-8000-000000000031'),
    'other_client_visible', (select count(*) from public.frizi_clients where id = '90000000-0000-4000-8000-000000000032'),
    'own_relationship_visible', (select count(*) from public.frizi_client_professional_relationships where client_id = '90000000-0000-4000-8000-000000000031'),
    'other_relationship_visible', (select count(*) from public.frizi_client_professional_relationships where client_id = '90000000-0000-4000-8000-000000000032'),
    'own_appointment_visible', (select count(*) from public.frizi_appointments where id = '90000000-0000-4000-8000-000000000061'),
    'other_appointment_visible', (select count(*) from public.frizi_appointments where id = '90000000-0000-4000-8000-000000000062'),
    'other_passport_visible', (select count(*) from public.frizi_client_passport_tokens where client_id = '90000000-0000-4000-8000-000000000032')
  );

select test_name, evidence
from frizi_rls_negative_results
order by test_name;

rollback;
