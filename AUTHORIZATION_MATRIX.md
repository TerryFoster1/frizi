# Frizi Authorization Matrix

Default rule: deny unless a policy or server route grants access.

| Resource | Anonymous | Client | Professional | Server/service role | Notes |
| --- | --- | --- | --- | --- | --- |
| Published professional profile | read public fields | read public fields | read own draft/private profile | manage after auth checks | Public read requires published, bookable, active/trialing |
| Professional private settings | none | none | read/update own | manage after auth checks | Must never trust browser professional ID |
| Client profile | none | read/update own | read/update relationship-scoped CRM client | manage after auth checks | Professional access requires relationship/manual ownership |
| Services | read active public services | read active public services | CRUD own | manage after auth checks | Public services require live/bookable pro |
| Availability | limited public slots only | limited public slots only | CRUD own | manage after auth checks | Raw scheduling config should stay minimal |
| Appointments | none | read own, create through validated booking | manage own professional appointments | manage after auth checks | Overlap trigger rejects active conflicts |
| CRM relationships | none | read own relationships | CRUD own professional relationships | manage after auth checks | Unique client/pro pair |
| CRM notes | none | none | own professional notes only | manage after auth checks | Current table has RLS but no direct policy; verify route usage |
| Conversations/messages | none | own conversations | own conversations | manage after auth checks | Participants only |
| Promos | read active public promos | read active public promos | CRUD own | manage after auth checks | Checkout enforcement incomplete |
| Invite tokens | active token metadata only | accept valid token | CRUD own tokens | manage after auth checks | Unique opaque token |
| Client passport token | none | read own token metadata | acceptance flow only | manage after auth checks | Possession alone should not expose full profile |
| Client media | none | own signed/private media | relationship/consent scoped | manage after auth checks | `frizi-client-media` is private |
| Pro media | read public assets | read public assets | owner-folder upload/update/delete | manage after auth checks | Public by design for portfolio/profile |
| Subscriptions | none | none | read own status | Stripe webhook/service routes | Browser success is not proof of payment |
| Stripe webhook events | none | none | none | write/read operationally | RLS no client policies is intentional fail-closed |
| Payment records | none | scoped future reads only | scoped future reads only | service routes | Client payments are not launch-ready |

