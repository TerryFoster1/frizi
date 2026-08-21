# Frizi Privacy Data Map

## Professional Data

| Category | Purpose | Location | Sensitivity | Access | Retention/export status |
| --- | --- | --- | --- | --- | --- |
| name, email | account, profile, booking | Supabase Auth, `frizi_profiles`, `frizi_professionals` | personal | owner, limited public display | OWNER/LEGAL DECISION REQUIRED |
| phone | contact/onboarding where collected | profile tables/client-side state | personal | owner/server | OWNER/LEGAL DECISION REQUIRED |
| profile/hero/portfolio photos | public professional marketing | `frizi-pro-media`, profile tables | personal/public | public read for pro media | deletion/export workflow needed |
| bio/specialties/services/prices | discovery and booking | professional/service tables | public when live | public after published/bookable | export workflow needed |
| address/location | local discovery, booking context | `frizi_professional_locations` | sensitive | owner/server, minimized public display | exact address publication requires owner choice |
| availability | booking slots | profile/settings/availability data | business-sensitive | owner, limited public slots | raw config should not be overexposed |
| Stripe IDs/subscription | billing | subscription/professional tables | financial identifier | owner minimal status, service role | retain per tax/accounting policy |
| CRM notes/messages | client service context | CRM/message tables | sensitive | owning professional only | deletion/export rules needed |
| invite tokens | client connection | `frizi_professional_invites` | security token | owner and server resolution | rotate/revoke supported where implemented |

## Client Data

| Category | Purpose | Location | Sensitivity | Access | Retention/export status |
| --- | --- | --- | --- | --- | --- |
| name/email | account, booking, CRM | Auth, profile/client tables | personal | client, relationship-scoped professional | deletion/export needed |
| phone | contact where collected | client/CRM data | personal | scoped | collection necessity review |
| profile photo | client identity | `frizi-client-media`, client tables | personal/private | client, scoped pro with consent/relationship | signed URLs, deletion workflow needed |
| inspiration photos | desired styles | `frizi-client-media`, photo table | sensitive/private | client, scoped pro | EXIF stripping not implemented |
| haircut history photos | appointment history/portfolio consent | storage/photo tables | sensitive | client and scoped pro with consent | consent/revocation audit needed |
| hair profile/notes | service quality | client/relationship/note tables | sensitive | scoped | professional private notes must not enter Passport automatically |
| appointment history | booking operations | `frizi_appointments` | personal/financial | client and owning pro | retention/legal decision needed |
| reviews | reputation | `frizi_reviews` | public if published | public where approved | moderation/removal rules needed |
| marketing consent | CASL compliance | relationship/campaign/consent tables | compliance | scoped/server | consent workflow incomplete |
| Passport token | sharing | `frizi_client_passport_tokens` | security token | client/server | rotation/revoke must be tested |

Known processors: Supabase, Vercel, Stripe, Google Workspace, GoDaddy/DNS. Data residency, DPA status, and privacy notice wording require owner/legal review.

## Manual Privacy Operations For Limited Launch

Until self-serve privacy tooling exists, the owner must process access/export/deletion/revocation requests manually:

1. Verify the requester controls the account email or has an equivalent support-verifiable identity signal.
2. Locate Supabase Auth user, `frizi_profiles`, role-specific profile rows, relationship rows, appointments, photos, Passport tokens, invite tokens, campaign/consent rows, Stripe identifiers, and relevant storage objects.
3. Export data in a readable CSV/JSON plus storage object list where legally required.
4. Revoke marketing consent by updating consent status and preserving suppression evidence.
5. Revoke Passport/invite sharing by expiring or rotating tokens.
6. Delete, anonymize, or retain records according to the approved retention/legal basis.
7. Record request metadata and action summary in an owner-controlled audit log.
