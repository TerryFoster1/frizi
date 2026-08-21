# Frizi Production Security Audit

Date: 2026-08-14

Scope:
- Client app: `C:\Users\kathr\Documents\Claude CoWork Files\Projects\Apps\Hairline`, Vercel project `frizi-client`, `https://frizi.ca`
- Professional app: `C:\Users\kathr\Documents\Claude CoWork Files\Projects\Apps\Frizi Pro Landing`, Vercel project `frizi-pro`, `https://pro.frizi.ca`
- Shared Supabase project: `rdddcpuvgpaztrgovdnz`
- Canonical migrations: `supabase/migrations`

Executive verdict: NOT READY FOR PRODUCTION.

Update: 2026-08-15

Targeted remediation was completed for demo-bundle cleanup, server-side rate limiting, and authenticated RLS negative testing. The production verdict remains NOT READY FOR PRODUCTION for paid launch because Stripe TEST monthly/annual subscription completion and Supabase leaked-password protection have not been proven from the live owner configuration.

Frizi has several correct security foundations: shared Supabase RLS is enabled on inspected public Frizi tables, public professional reads are gated by published/bookable/active subscription state, client media is private, professional media is isolated by owner folder, invite/passport tokens are unique, appointment overlap rejection exists, Pro subscription checkout derives the professional from the authenticated token, and Stripe webhooks verify signatures.

The platform is not yet ready to sell access to 40 professionals because critical end-to-end paths remain incomplete or insufficiently proven: production bundles still contain demo/persona code, some production client APIs previously returned demo financial/catalog data and were only just fail-closed, client appointment/product checkout is not production-authoritative, full multi-account RLS negative tests were not completed with real JWT contexts, rate limiting is not implemented for abuse-sensitive routes, Pro webhook processing needed a status bug fix, and privacy/legal/account deletion/export processes are not implemented.

## Findings

### F-CRIT-001: Production demo/fixture contamination

Component: Client and Pro frontend bundles, client demo API routes

Severity: Critical

Scenario: A production user or scraper can see demo names/logic in production bundles. Before this hardening pass, production client API routes for commerce catalog, payment history, and tip analytics returned demo-looking business data.

Evidence:
- Client bundle scan still finds `demo=22`, `Mara=8`, `Omar=6`, `Ari=41`.
- Pro bundle scan still finds `demo=2`, `Omar=4`, `Ari=47`.
- Live APIs were previously observed returning demo catalog/payment/tip data.

Remediation:
- Added `api/_environment.mjs`.
- Production client API routes now fail closed unless explicitly on localhost/demo host or `FRIZI_ENABLE_DEMO_APIS=true`.
- Product checkout is disabled in production.
- Appointment checkout is disabled unless `FRIZI_APPOINTMENT_PAYMENTS_ENABLED=true`.

Status: Fixed for the old production persona/demo contamination findings. Public demo APIs are fail-closed, old named demo personas were removed from production source/API/dist scans, and product commerce remains an explicit Coming Soon preview only.

Regression test:
- Verify `https://frizi.ca/api/commerce-catalog`, `payment-history`, `tip-analytics`, and checkout routes return disabled/coming-soon responses in production.

Residual risk: High until production bundles are split from demo code.

### F-HIGH-001: Incomplete client-side payments and promo enforcement

Component: `api/create-checkout-session.ts`, client pricing/commerce modules

Severity: High

Scenario: Browser-submitted checkout payloads can still route into demo pricing code if appointment payment is enabled. Production appointment/product payment should be server-authoritative against Supabase services, promos, availability, and appointment ownership.

Status: Mitigated by fail-closed production gate. Not production-ready.

Regression test: Production checkout must return 501 unless a real server-authoritative payment implementation is enabled.

### F-HIGH-002: Pro Stripe webhook status mismatch

Component: Pro `api/stripe-webhook.ts`

Severity: High

Scenario: The webhook wrote `ignored` and `error`, but the database constraint allows `processing`, `processed`, and `failed`. Non-Pro or malformed subscription events could fail processing and cause Stripe retries.

Remediation: Changed ignored events to `processed` and missing metadata failures to `failed`.

Status: Fixed locally, requires deployment.

### F-HIGH-003: RLS negative tests incomplete

Component: Supabase RLS and storage policies

Severity: High

Scenario: Policy inspection shows good intent, but the audit did not complete controlled JWT-based Pro A/Pro B and Client A/Client B IDOR tests across all resources.

Evidence: RLS is enabled on inspected tables; key policies scope by `frizi_current_professional_id()` and `frizi_current_client_id()`. Advisors also show several RLS-enabled internal tables with no policies, which is fail-closed but needs intentional documentation.

Status: Fixed for the tested core tables after remediation.

Remediation:
- Added `20260815043000_fix_frizi_identity_helper_rls_recursion.sql` so `frizi_current_professional_id()` and `frizi_current_client_id()` are stable security-definer lookup helpers. This removed recursive RLS evaluation during authenticated tests.
- Added `20260815044000_remove_public_invite_table_reads.sql` so active invite rows are no longer directly readable by every anonymous/authenticated database client. Public invite resolution stays server-side through `/api/invite`.
- Added `tests/security/frizi_rls_negative.sql`.

RLS negative test result:
- Professional A: own professional profile/service visible; Professional B private profile, service, location, CRM relationship, invite row, appointment, and service update all blocked.
- Client A: own client profile, CRM relationship, and appointment visible; Client B profile, relationship, appointment, and passport token all blocked.

### F-HIGH-004: Abuse-sensitive endpoints lack durable rate limiting

Component: Auth, invite, passport, booking, checkout, public discovery, promo/messaging routes

Severity: High

Scenario: Attackers can automate signup/resend, invite resolution, public search, checkout creation, and future promo/messaging actions. Client-side throttles are not sufficient.

Status: Partially fixed.

Remediation:
- Added Supabase-backed distributed rate limiting table/function in `20260815034943_frizi_rate_limits.sql`.
- Added shared API helpers in both apps.
- Covered invite lookup/acceptance, client passport, client appointment API, checkout/commerce read APIs, Pro checkout, Pro subscription reconciliation, Pro Connect onboarding, and Pro client passport.

Verified:
- `frizi_consume_rate_limit()` allowed the first smoke request and rejected the second fixed-bucket request with a retry delay.

Residual risk:
- Supabase Auth-hosted signup, sign-in, resend verification, and password reset still rely on Supabase provider-side abuse controls because those requests do not pass through Frizi server routes.

### F-HIGH-005: Account deletion/export and retention processes incomplete

Component: Privacy/process layer

Severity: High for production privacy readiness

Scenario: Clients and professionals need clear deletion, export, correction, and retention procedures before commercial launch.

Status: Documented as owner/legal/process work, not implemented.

## Verified Controls

- Vercel projects are linked as `frizi-client` and `frizi-pro`.
- `.vercel/output` was absent in both repos before source builds.
- Builds passed for both apps.
- Client tests passed: 12/12.
- `npm audit --audit-level=moderate` is clean after non-force fixes.
- Supabase RLS is enabled on inspected public Frizi tables.
- Storage MIME limits reject non-image MIME types for Frizi buckets.
- Stripe webhooks verify signatures with raw request body.
- Pro checkout uses server-configured monthly/annual Price IDs.
- Pro checkout derives professional identity from the bearer token.

## Launch Blockers

- Complete Stripe TEST monthly and annual subscription checkout proof from the live Pro app, including webhook delivery, idempotency, subscription activation, and published/bookable state.
- Enable or owner-verify Supabase Auth leaked-password protection. The available CLI/MCP surface in this run did not expose the dashboard auth toggle.
- Keep client payments/commerce disabled or replace demo pricing with server-authoritative Supabase validation.
- Complete privacy/export/deletion/retention process decisions.

## 2026-08-15 Verification Evidence

- Client tests: `npm.cmd run test` passed 12/12.
- Client build: `npm.cmd run build` passed.
- Pro build: `npm.cmd run build` passed.
- Client dependency audit: `npm.cmd audit --audit-level=moderate` found 0 vulnerabilities.
- Pro dependency audit: `npm.cmd audit --audit-level=moderate` found 0 vulnerabilities.
- Supabase schema lint: `supabase.cmd db lint --linked` returned no schema errors.
- Bundle/persona scan: no matches for the old named demo personas or forbidden demo phrases in client `src`, `api`, `tests`, `dist` or Pro `src`, `api`, `dist`.
- Secret scan: no Stripe secret/webhook, Supabase secret/service-role, SMTP, or concrete secret-value patterns found in client `dist/src` or Pro `dist/src`. Server API files reference environment variable names only.
