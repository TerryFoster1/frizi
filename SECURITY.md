# Security Policy

Frizi is in controlled pre-launch hardening. Do not submit real customer secrets, card data, SMTP credentials, Stripe secrets, Supabase secret keys, or private client/professional data in bug reports.

## Reporting

Report security issues to the Frizi owner privately. Include:
- affected URL or route
- reproduction steps
- expected versus actual result
- whether the issue affects client data, professional data, payments, auth, invites, or media
- screenshots only if they do not expose private user data

## Severity Handling

Critical examples:
- cross-user private data access
- exposed service-role, Stripe secret, webhook secret, SMTP credential, or auth token
- auth bypass
- payment manipulation
- unsigned/forged webhook acceptance

High examples:
- IDOR/BOLA in bookings, CRM, invites, passport, or media
- production demo data returned as live data
- unsafe privileged server route
- missing rate limits on abuse-sensitive live endpoints

## Owner Process

1. Triage within one business day for Critical/High reports.
2. Preserve logs and affected deployment IDs.
3. Reproduce using controlled test accounts.
4. Patch in the canonical repo.
5. Deploy a fresh production source build.
6. Rotate credentials when exposure is confirmed or cannot be ruled out.
7. Document customer/user notification needs with privacy counsel.

