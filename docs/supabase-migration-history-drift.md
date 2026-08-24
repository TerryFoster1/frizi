# Supabase migration history drift

Date: 2026-08-24

Shared Supabase project: `rdddcpuvgpaztrgovdnz`

Canonical migration directory:

`C:\Users\kathr\Documents\Claude CoWork Files\Projects\Apps\Hairline\supabase\migrations`

## Current state

The production schema has the Frizi Pro Free appointment requirement applied:

- `public.frizi_appointments.service_id` is nullable.
- Canonical migration: `20260824235500_frizi_free_basic_booking_service_optional.sql`
- Supabase migration history was repaired to mark `20260824235500` as `applied` after verifying the live column state.

## Remaining drift

`supabase db push --linked --dry-run` still reports older remote migration versions that are not present in the local migration directory. The CLI suggested reverting those remote history entries and then running `supabase db pull`.

Do not run that repair blindly on production. Those older entries must be reconciled by comparing the live schema to the canonical migration set first, then choosing one deliberate path:

1. Restore the missing migration files if their original SQL can be recovered.
2. Generate a reviewed baseline/squash migration from the current production schema.
3. Repair only the migration-history rows that are proven to be superseded by canonical local migrations.

## Salon website-widget migration

The untracked migration `20260824184321_frizi_salon_website_widgets.sql` remains local-only/unapplied. It was not applied or repaired during the Pro Free stabilization pass.

## Safe rule

For future Salon phases, do not use `supabase db push` against production until the older migration-history drift has been intentionally reconciled. Direct schema changes should be avoided except for small verified emergency fixes with a matching canonical migration-history repair.
