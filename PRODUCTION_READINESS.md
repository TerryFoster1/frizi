# Frizi Production Readiness

Verdict: NOT READY FOR PRODUCTION.

Update: 2026-08-15 targeted hardening improved the technical baseline, but the verdict remains NOT READY FOR PRODUCTION for paid onboarding until live Stripe TEST subscription proof and leaked-password protection verification are complete.

## Ready Foundations

- Two canonical Vercel projects are identified: `frizi-client` and `frizi-pro`.
- Shared Supabase project is identified: `rdddcpuvgpaztrgovdnz`.
- Canonical migration history is in this repo under `supabase/migrations`.
- RLS is enabled on inspected Frizi public tables.
- Professional public reads are gated by published/bookable/subscription state.
- Client media bucket is private.
- Professional media bucket is public but owner-write scoped.
- Invite/passport tokens are unique.
- CRM relationship uniqueness prevents duplicate client/pro pairs.
- Appointment overlap trigger exists.
- Pro subscription checkout uses server Price IDs and bearer-derived professional identity.
- Stripe webhook routes verify raw-body signatures.
- Baseline Vercel security headers were added.
- Public demo financial/catalog API routes were fail-closed.
- Dependency audits are currently clean.
- Old named demo/persona contamination was removed from production bundles.
- Supabase-backed distributed rate limiting now protects Frizi-owned abuse-sensitive API routes.
- Authenticated RLS negative tests now pass for core Pro A/Pro B and Client A/Client B isolation.

## Not Ready

- Stripe TEST monthly/annual subscription activation has not been completed end to end from the live Pro app in this run.
- Production client booking/payment is not server-authoritative and must remain disabled.
- Products/recommendations commerce must remain Coming Soon.
- Privacy deletion/export/retention workflows are manual owner processes until self-serve automation is implemented.
- CASL promotional consent/unsubscribe/suppression is not production-complete.
- Supabase leaked-password protection still needs owner dashboard verification/enabling.
- Independent accessibility, privacy/legal, and penetration reviews are not complete.

## Required Before Selling to 40 Professionals

1. Complete Stripe TEST monthly and annual subscription webhook verification after deployment.
2. Enable or confirm Supabase leaked-password protection.
3. Keep client payments and commerce disabled or replace with canonical Supabase-backed checkout.
4. Confirm privacy/legal policy language.
5. Operate the documented manual deletion/export/revocation workflow until self-serve controls are built.
6. Run final owner acceptance with real Pro/client accounts before charging customers.

## Latest Hardening Evidence

- `tests/security/frizi_rls_negative.sql` passed against linked Supabase after fixing identity-helper recursion and removing direct public invite-table reads.
- RLS evidence: Professional A cannot read/update Professional B private profile/services/location/CRM/invite/appointment rows; Client A cannot read Client B profile/relationship/appointment/passport rows.
- Rate-limit migration `20260815034943_frizi_rate_limits.sql` was applied and smoke-tested.
- Client tests passed 12/12; client and Pro builds passed; both dependency audits found 0 vulnerabilities.
- Production bundle scans found no old named demo/persona terms and no privileged secret values.
- Fresh production source deployments completed on 2026-08-15:
  - Client: `https://frizi-client-a4no1pup7-terryfoster1s-projects.vercel.app`, aliased to `https://frizi.ca`.
  - Pro: `https://frizi-3052q456f-terryfoster1s-projects.vercel.app`, aliased to `https://pro.frizi.ca`.
- Live checks after deployment:
  - `https://frizi.ca/api/commerce-catalog` returns `501` with `status: coming_soon`.
  - `https://frizi.ca/api/create-checkout-session` returns `501` with `status: coming_soon`.
  - Unsigned `https://pro.frizi.ca/api/stripe-webhook` returns `400 Missing Stripe signature`.

## Manual Owner Workflow Until Automation Exists

For a controlled launch, deletion/export/access/revocation requests must be handled manually by the owner:
- Verify requester identity using the account email and recent account activity before acting.
- Export relevant Supabase rows and storage object inventory for that user/professional/client.
- Revoke marketing consent by updating relationship/campaign consent state and maintaining suppression records.
- Revoke Passport/invite sharing by marking tokens revoked/expired and rotating shared links.
- Delete or anonymize profile, CRM, photo, appointment, and auth data according to legal/accounting retention decisions.
- Record the request, decision, operator, timestamp, and affected table/object IDs in an owner-held audit log.
