-- Canonical Frizi notifications and appointment lifecycle hardening.
-- Notifications are lightweight pointers to canonical source rows.

alter table public.frizi_appointments
  drop constraint if exists frizi_appointments_status_check,
  add constraint frizi_appointments_status_check
    check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed', 'requested', 'expired'));

update public.frizi_appointments
set status = 'expired',
    updated_at = now()
where status in ('pending', 'requested')
  and ends_at < now();

create table if not exists public.frizi_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('client', 'professional')),
  notification_type text not null,
  title text not null,
  body text,
  professional_id uuid references public.frizi_professionals(id) on delete cascade,
  client_id uuid references public.frizi_clients(id) on delete cascade,
  relationship_id uuid references public.frizi_client_professional_relationships(id) on delete cascade,
  appointment_id uuid references public.frizi_appointments(id) on delete cascade,
  conversation_id uuid references public.frizi_conversations(id) on delete cascade,
  message_id uuid references public.frizi_messages(id) on delete cascade,
  promotion_id text references public.frizi_promotions(id) on delete set null,
  action_path text,
  source_key text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists frizi_notifications_source_key_idx
  on public.frizi_notifications (source_key)
  where source_key is not null;

create index if not exists frizi_notifications_recipient_unread_idx
  on public.frizi_notifications (recipient_user_id, read_at, created_at desc);

create index if not exists frizi_notifications_appointment_idx
  on public.frizi_notifications (appointment_id)
  where appointment_id is not null;

alter table public.frizi_notifications enable row level security;

drop policy if exists "users can read own notifications" on public.frizi_notifications;
create policy "users can read own notifications"
on public.frizi_notifications
for select
to authenticated
using (recipient_user_id = (select auth.uid()));

drop policy if exists "users can mark own notifications read" on public.frizi_notifications;
create policy "users can mark own notifications read"
on public.frizi_notifications
for update
to authenticated
using (recipient_user_id = (select auth.uid()))
with check (recipient_user_id = (select auth.uid()));

drop policy if exists "participants can create source notifications" on public.frizi_notifications;
create policy "participants can create source notifications"
on public.frizi_notifications
for insert
to authenticated
with check (
  recipient_user_id = (select auth.uid())
  or (
    appointment_id is not null
    and exists (
      select 1
      from public.frizi_appointments appointment
      join public.frizi_clients client_record on client_record.id = appointment.client_id
      join public.frizi_profiles client_profile on client_profile.id = client_record.profile_id
      join public.frizi_professionals professional_record on professional_record.id = appointment.professional_id
      join public.frizi_profiles pro_profile on pro_profile.id = professional_record.profile_id
      where appointment.id = frizi_notifications.appointment_id
        and (
          (
            appointment.professional_id = public.frizi_current_professional_id()
            and frizi_notifications.recipient_user_id = client_profile.auth_user_id
          )
          or (
            appointment.client_id = public.frizi_current_client_id()
            and frizi_notifications.recipient_user_id = pro_profile.auth_user_id
          )
        )
    )
  )
  or (
    message_id is not null
    and exists (
      select 1
      from public.frizi_messages message
      join public.frizi_conversations conversation on conversation.id = message.conversation_id
      join public.frizi_clients client_record on client_record.id = conversation.client_id
      join public.frizi_profiles client_profile on client_profile.id = client_record.profile_id
      join public.frizi_professionals professional_record on professional_record.id = conversation.professional_id
      join public.frizi_profiles pro_profile on pro_profile.id = professional_record.profile_id
      where message.id = frizi_notifications.message_id
        and (
          (
            conversation.professional_id = public.frizi_current_professional_id()
            and frizi_notifications.recipient_user_id = client_profile.auth_user_id
          )
          or (
            conversation.client_id = public.frizi_current_client_id()
            and frizi_notifications.recipient_user_id = pro_profile.auth_user_id
          )
        )
    )
  )
);

grant select, insert, update on public.frizi_notifications to authenticated;

comment on table public.frizi_notifications is
  'Canonical in-app Frizi notifications. Rows point to source appointments, conversations, messages, promos, or relationships.';
