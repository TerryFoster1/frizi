# Backup and Recovery

Current state:
- Supabase is the canonical shared database.
- Vercel hosts the client and professional apps.
- Stripe is the system of record for payment card processing and subscription objects.
- Git repositories are the application source of truth.

Open items before launch:
- Confirm Supabase plan backup frequency and point-in-time recovery availability.
- Define RPO/RTO targets for a controlled 40-professional launch.
- Document who can restore Supabase and who approves restores.
- Test restore into a non-production branch/project.
- Confirm Storage object backup/restore expectations.
- Document Stripe reconciliation after restore.
- Ensure migrations in `Hairline/supabase/migrations` can recreate schema.

Suggested initial targets:
- RPO: 24 hours or better.
- RTO: 1 business day for controlled launch.
- Manual export cadence: OWNER DECISION REQUIRED if Supabase tier lacks sufficient PITR.

