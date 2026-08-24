create table if not exists public.frizi_client_passport_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.frizi_clients(id) on delete cascade,
  token text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists frizi_client_passport_tokens_client_idx
  on public.frizi_client_passport_tokens (client_id, status, created_at desc);

alter table public.frizi_client_passport_tokens enable row level security;

drop policy if exists "clients can read own passport token metadata" on public.frizi_client_passport_tokens;
create policy "clients can read own passport token metadata"
on public.frizi_client_passport_tokens
for select
to authenticated
using (client_id = public.frizi_current_client_id());

grant select on public.frizi_client_passport_tokens to authenticated;
