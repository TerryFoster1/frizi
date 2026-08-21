# Frizi Incident Response

## Severity 1

Use for exposed secrets, cross-user private data access, unauthorized payments, auth bypass, or production data corruption.

Steps:
1. Preserve evidence: deployment URL, commit, logs, timestamps, affected route.
2. Contain: disable affected feature flag/API route where safe.
3. Rotate exposed credentials if exposure is confirmed or likely.
4. Revoke affected sessions/tokens where supported.
5. Patch in canonical repo and deploy a fresh production source build.
6. Validate with negative tests.
7. Determine notification obligations with privacy counsel.
8. Write a post-incident report.

## Operational Contacts

OWNER INPUT REQUIRED:
- business owner
- technical responder
- privacy/legal contact
- Stripe account owner
- Supabase owner
- Vercel owner
- Google Workspace admin

## Evidence Rules

Do not paste secrets, passwords, full payment payloads, private CRM notes, or private user data into public tickets or chat logs.

