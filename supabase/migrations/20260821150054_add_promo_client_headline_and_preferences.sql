alter table public.frizi_promotions
  add column if not exists client_headline text;

comment on column public.frizi_promotions.client_headline is
  'Client-facing promo headline. Internal promotion name remains professional-only management copy.';

alter table public.frizi_clients
  add column if not exists notification_preferences jsonb not null default jsonb_build_object(
    'appointment_notifications_enabled', true,
    'message_notifications_enabled', true,
    'promotional_notifications_enabled', false
  ),
  add column if not exists search_preferences jsonb not null default jsonb_build_object(
    'search_radius_km', 15,
    'location_mode', 'approximate'
  );

comment on column public.frizi_clients.notification_preferences is
  'Client-owned notification consent/preferences. Promotional notifications are distinct from transactional booking and message notifications.';

comment on column public.frizi_clients.search_preferences is
  'Client-owned location/search preferences for local professional discovery.';
