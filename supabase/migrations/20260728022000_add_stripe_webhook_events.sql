create table if not exists public.frizi_stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  livemode boolean not null default false,
  api_version text,
  event_created_at timestamptz,
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'processed', 'failed')),
  payload jsonb not null,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists frizi_stripe_webhook_events_type_received_idx
  on public.frizi_stripe_webhook_events (event_type, received_at desc);

alter table public.frizi_stripe_webhook_events enable row level security;

comment on table public.frizi_stripe_webhook_events is
  'Durable Stripe webhook receipt and idempotency table. Server webhook code inserts event ids before processing so retries do not double-apply payment side effects.';
