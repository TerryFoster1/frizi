-- PostgREST/Supabase upsert with onConflict: 'source_key' requires a real
-- unique constraint. A partial unique index does not satisfy the conflict
-- target, which prevented canonical notification rows from being created.
drop index if exists public.frizi_notifications_source_key_idx;

alter table public.frizi_notifications
  drop constraint if exists frizi_notifications_source_key_unique;

alter table public.frizi_notifications
  add constraint frizi_notifications_source_key_unique unique (source_key);
