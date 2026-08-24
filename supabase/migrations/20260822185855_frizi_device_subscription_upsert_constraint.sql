do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'frizi_device_subscriptions_user_token_unique'
      and conrelid = 'public.frizi_device_subscriptions'::regclass
  ) then
    alter table public.frizi_device_subscriptions
      add constraint frizi_device_subscriptions_user_token_unique
      unique (user_id, device_token);
  end if;
end
$$;
