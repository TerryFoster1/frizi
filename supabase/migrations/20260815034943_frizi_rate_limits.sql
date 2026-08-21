create table if not exists public.frizi_rate_limits (
  id text primary key,
  scope text not null,
  bucket text not null,
  window_start timestamptz not null default now(),
  window_seconds integer not null,
  request_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint frizi_rate_limits_scope_bucket_key unique (scope, bucket),
  constraint frizi_rate_limits_positive_count check (request_count > 0),
  constraint frizi_rate_limits_positive_window check (window_seconds > 0)
);

alter table public.frizi_rate_limits enable row level security;

revoke all on table public.frizi_rate_limits from anon, authenticated;

create index if not exists frizi_rate_limits_updated_at_idx
  on public.frizi_rate_limits (updated_at);

create or replace function public.frizi_consume_rate_limit(
  p_scope text,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_scope is null or length(trim(p_scope)) = 0 then
    raise exception 'rate limit scope is required';
  end if;

  if p_bucket is null or length(trim(p_bucket)) = 0 then
    raise exception 'rate limit bucket is required';
  end if;

  if p_limit is null or p_limit < 1 or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'rate limit configuration is invalid';
  end if;

  insert into public.frizi_rate_limits as limits (
    id,
    scope,
    bucket,
    window_start,
    window_seconds,
    request_count,
    updated_at
  )
  values (
    p_scope || ':' || p_bucket,
    p_scope,
    p_bucket,
    v_now,
    p_window_seconds,
    1,
    v_now
  )
  on conflict (scope, bucket)
  do update set
    window_start = case
      when limits.window_start <= v_now - make_interval(secs => p_window_seconds) then v_now
      else limits.window_start
    end,
    window_seconds = p_window_seconds,
    request_count = case
      when limits.window_start <= v_now - make_interval(secs => p_window_seconds) then 1
      else limits.request_count + 1
    end,
    updated_at = v_now
  returning limits.window_start, limits.request_count
  into v_window_start, v_count;

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  retry_after_seconds := case
    when allowed then 0
    else greatest(ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::integer, 1)
  end;

  return next;
end;
$$;

revoke all on function public.frizi_consume_rate_limit(text, text, integer, integer) from public;
revoke all on function public.frizi_consume_rate_limit(text, text, integer, integer) from anon;
revoke all on function public.frizi_consume_rate_limit(text, text, integer, integer) from authenticated;
grant execute on function public.frizi_consume_rate_limit(text, text, integer, integer) to service_role;
