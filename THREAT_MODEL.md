# Frizi Threat Model

## Trust Boundaries

- Browser/mobile web clients are untrusted.
- Supabase public/publishable keys are public by design and must rely on RLS.
- Vercel API routes may use server secrets and must re-enforce authorization.
- Stripe Checkout is trusted for card entry; Frizi must not handle raw card data.
- Stripe webhooks are trusted only after signature verification.
- Supabase service keys are backend-only and bypass RLS, so every service-route mutation must validate ownership.
- Demo hosts must be isolated from `frizi.ca` and `pro.frizi.ca`.

## Key Threats

| Threat | Actor | Asset | Existing control | Weakness | Severity | Remediation |
| --- | --- | --- | --- | --- | --- | --- |
| Cross-professional CRM access | malicious professional | CRM notes, clients, appointments | RLS policies using current professional helper | JWT negative tests incomplete | High | Complete Pro A/Pro B IDOR tests |
| Cross-client data access | malicious client | client profile/photos/passport | client RLS helper, private bucket | JWT negative tests incomplete | High | Complete Client A/Client B tests |
| Demo contamination | anonymous/user | trust, payments, private-looking data | production API fail-closed patch | demo remains in bundles | Critical | split demo from production build |
| Forged Stripe webhook | anonymous attacker | subscriptions/payments | Stripe signature verification | Pro status mismatch was present | High | patched status values; retest webhooks |
| Replay Stripe webhook | attacker/retry | subscription/payment records | unique event ID table | duplicate test incomplete | Medium | automated replay tests |
| Browser-submitted price | malicious client | payments/promos | production checkout disabled | real payment flow incomplete | High | server-authoritative checkout |
| Invite token abuse | malicious client | professional-client relationship | opaque unique tokens, active/expiry check | rate limits absent | High | rate-limit resolve/accept |
| Passport QR abuse | malicious professional | client hair profile/photos | opaque tokens, Pro auth required | consent model needs more tests | High | rotate/revoke tests and field policy |
| Malicious upload | authenticated user | storage/public pages | MIME allowlist, 10 MB limit, owner folder | EXIF stripping not implemented | Medium | image processing/metadata stripping |
| Credential stuffing | attacker | accounts | Supabase Auth | leaked-password protection disabled | High | enable Supabase setting, add WAF/rate limits |
| Promo spam | compromised professional | clients/contact channels | Coming Soon/partial workflows | no durable quotas/suppression | High | disable real sends until consent/rate limits exist |
| Compromised service secret | attacker | all backend data | env vars sensitive in Vercel | rotation/playbooks incomplete | Critical | rotate if exposed, document break-glass |

