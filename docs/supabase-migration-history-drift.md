# Supabase migration baseline

Date: 2026-08-24

Shared Supabase project: `rdddcpuvgpaztrgovdnz`

Canonical migration directory:

`C:\Users\kathr\Documents\Claude CoWork Files\Projects\Apps\Hairline\supabase\migrations`

## Baseline result

The canonical migration directory and the live Supabase migration ledger have
been reconciled.

- Local migration files: 56
- Remote migration-history entries: 56
- Local-only migration versions: 0
- Remote-only migration versions: 0
- Version/name mismatches: 0

The production schema was verified for the known stabilization requirements:

- `20260824211500_frizi_freemium_entitlement_foundation` is applied.
- `20260824223000_frizi_freemium_private_feature_gates` is applied.
- `public.frizi_professionals.account_plan` exists.
- `public.frizi_salons.account_plan` exists.
- `public.frizi_professional_resolved_plan(...)` exists.
- `public.frizi_professional_has_capability(...)` exists.
- `public.frizi_professional_is_publicly_bookable(...)` exists.
- `public.frizi_appointments.service_id` is nullable.
- `public.frizi_professionals.professional_title` exists.
- `public.frizi_salon_widget_configs` exists.
- `public.frizi_device_subscriptions` has the
  `frizi_device_subscriptions_user_token_unique` constraint.

## What changed

Several canonical migration filenames had the same migration names as the live
Supabase history but different timestamp prefixes. Those local files were
renamed to match the live applied versions so the repository is now aligned with
the production ledger.

The live Supabase ledger also contained
`20260822185855_frizi_device_subscription_upsert_constraint`, but the matching
local migration file was missing. The file has been restored in the canonical
migration directory.

The following local migration effects were already present in production and
were repaired to `applied` in Supabase migration history:

- `20260728231523_frizi_pro_functional_crm_promos_invites.sql`
- `20260814000100_frizi_pro_go_live_subscription_gate.sql`
- `20260815043000_fix_frizi_identity_helper_rls_recursion.sql`
- `20260815044000_remove_public_invite_table_reads.sql`
- `20260816000123_harden_professional_identity_discovery.sql`
- `20260821150054_add_promo_client_headline_and_preferences.sql`
- `20260823204316_add_profile_offer_flags_to_promotions.sql`
- `20260824180800_frizi_salon_marketing_automations.sql`
- `20260824182354_frizi_salon_reviews_reputation.sql`
- `20260824183456_frizi_salon_gifts_packages_memberships.sql`
- `20260824184321_frizi_salon_website_widgets.sql`

`20260824123000_add_professional_title.sql` was the only local migration whose
schema effect was missing. It was applied as an additive change, verified, and
then repaired to `applied` in migration history.

## Dry-run status

`supabase db push --linked --dry-run` no longer reaches a migration-drift
comparison because this shell does not have `SUPABASE_DB_PASSWORD` set. The CLI
fails authentication with:

`password authentication failed for user "cli_login_postgres"`

Direct Management API SQL checks confirmed the local and remote migration
versions are aligned. To run future `supabase db push --linked --dry-run`
checks from this machine, set `SUPABASE_DB_PASSWORD` for the linked Supabase
project without committing or printing it.

## Safe rule

Future Salon schema work can continue from this baseline, but every new schema
change must be committed first as a timestamped migration under this canonical
directory and then applied through the normal Supabase workflow. Do not create
manual production schema changes without a matching canonical migration.
