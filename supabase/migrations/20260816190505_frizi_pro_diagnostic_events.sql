create table if not exists public.frizi_pro_diagnostic_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trace_id text not null,
  auth_user_id uuid not null default auth.uid(),
  professional_id uuid,
  area text not null,
  operation text not null,
  table_or_endpoint text,
  http_status integer,
  error_code text,
  error_message text,
  error_details text,
  elapsed_ms integer,
  route text,
  app_version text,
  result_type text not null check (result_type in ('success', 'error', 'timeout', 'route', 'info'))
);

alter table public.frizi_pro_diagnostic_events enable row level security;

create index if not exists frizi_pro_diagnostic_events_trace_idx
  on public.frizi_pro_diagnostic_events (trace_id);

create index if not exists frizi_pro_diagnostic_events_auth_created_idx
  on public.frizi_pro_diagnostic_events (auth_user_id, created_at desc);

create index if not exists frizi_pro_diagnostic_events_professional_created_idx
  on public.frizi_pro_diagnostic_events (professional_id, created_at desc)
  where professional_id is not null;

revoke all on public.frizi_pro_diagnostic_events from anon;
revoke all on public.frizi_pro_diagnostic_events from authenticated;
grant insert, select on public.frizi_pro_diagnostic_events to authenticated;

create policy "professionals can insert own diagnostic events"
  on public.frizi_pro_diagnostic_events
  for insert
  to authenticated
  with check ((select auth.uid()) = auth_user_id);

create policy "professionals can read own diagnostic events"
  on public.frizi_pro_diagnostic_events
  for select
  to authenticated
  using ((select auth.uid()) = auth_user_id);

comment on table public.frizi_pro_diagnostic_events is
  'Safe operational diagnostics for Frizi Pro authenticated runtime failures. No secrets, tokens, PII payloads, notes, messages, or request bodies should be stored here.';
