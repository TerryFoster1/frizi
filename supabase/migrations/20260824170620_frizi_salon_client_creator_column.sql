alter table public.frizi_clients
  add column if not exists created_by_salon_id uuid references public.frizi_salons(id) on delete set null;

drop policy if exists "salon members can create manual CRM clients" on public.frizi_clients;
create policy "salon members can create manual CRM clients"
on public.frizi_clients
for insert
to authenticated
with check (
  profile_id is null
  and (
    (
      created_by_salon_id is not null
      and public.frizi_is_salon_member(created_by_salon_id, array['owner', 'manager', 'reception'])
    )
    or exists (
      select 1
      from public.frizi_salon_staff_assignments assignment
      where assignment.professional_id = frizi_clients.created_by_professional_id
        and assignment.employment_status = 'active'
        and public.frizi_is_salon_member(assignment.salon_id, array['owner', 'manager', 'reception'])
    )
  )
);

create index if not exists frizi_clients_created_by_salon_idx
  on public.frizi_clients (created_by_salon_id, updated_at desc);

comment on column public.frizi_clients.created_by_salon_id is
  'Salon that created a manual/walk-in client record before the client claims a Frizi account.';
