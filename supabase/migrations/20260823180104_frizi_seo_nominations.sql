create table if not exists public.frizi_professional_nominations (
  id uuid primary key default gen_random_uuid(),
  professional_name text not null,
  salon_name text,
  city text not null,
  professional_type text not null,
  recommendation_reason text,
  contact_detail text,
  nominator_email text,
  source_path text,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'archived', 'claimed')),
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists frizi_professional_nominations_dedupe_idx
  on public.frizi_professional_nominations (dedupe_key);

create index if not exists frizi_professional_nominations_status_created_idx
  on public.frizi_professional_nominations (status, created_at desc);

alter table public.frizi_professional_nominations enable row level security;

drop policy if exists "public can submit professional nominations"
  on public.frizi_professional_nominations;
create policy "public can submit professional nominations"
  on public.frizi_professional_nominations
  for insert
  to anon, authenticated
  with check (
    length(trim(professional_name)) > 0
    and length(trim(city)) > 0
    and length(trim(professional_type)) > 0
  );

grant insert on public.frizi_professional_nominations to anon, authenticated;
grant select, insert, update, delete on public.frizi_professional_nominations to service_role;

comment on table public.frizi_professional_nominations is
  'Client-submitted nominations for professionals who are not yet live on Frizi. This is lead/cms data, not a public professional listing.';
