# Legal Review Gaps

This file is not legal advice.

LEGAL REVIEW REQUIRED before commercial launch for:
- Terms of Use alignment with actual bookings, subscriptions, reviews, promos, invites, and Client Passport.
- Privacy Policy coverage for Supabase, Vercel, Stripe, Google Workspace, GoDaddy/DNS, photos, location, CRM notes, messages, reviews, and support logs.
- PIPEDA access, correction, deletion, retention, complaints, and cross-border processor language.
- CASL promotional messaging consent, unsubscribe, suppression, sender identity, and professional/user responsibilities.
- Payment terms for $29/month and annual subscription, renewals, cancellation, refunds, taxes, and failed payment handling.
- Future client appointment payments/deposits/tips.
- Future product commerce, dropshipping, returns, recalls, marketplace/affiliate status, tax, and product safety.
- Review moderation/takedown rules.
- Client photo consent, portfolio consent, and revocation.
- Hair Passport sharing scope and consent wording.
- Accessibility/WCAG obligations for public and paid flows.

Do not present Products/Commerce as live until policy, tax, fulfilment, returns, and safety terms are approved.

## Controlled Canadian Launch Decision List

Legal-document review required before launch:
- Confirm PIPEDA privacy notice accuracy for Supabase, Vercel, Stripe, Google Workspace, DNS, support logs, location, photos, Client Passport, CRM notes, reviews, and messages.
- Confirm CASL consent, unsubscribe, suppression, sender identification, and professional responsibility language before any promo send is treated as live.
- Confirm photo consent/revocation wording for client profile photos, inspiration photos, haircut history, portfolio use, and review/social reuse.
- Confirm location wording for professional discovery and whether exact addresses are public, appointment-only, or masked.
- Confirm Stripe/payment wording for Pro subscription, renewal, cancellation, taxes, failed payments, refunds, and future client payments/tips.

Engineering controls already implemented or intentionally constrained:
- Product commerce and client checkout remain Coming Soon/fail-closed.
- Client media bucket is private and owner-folder scoped.
- Professional media upload is owner-folder scoped.
- Invite and Passport flows use tokenized server-side validation.
- RLS regression tests cover core cross-user private data isolation.

Post-launch enhancements:
- Self-serve privacy export/deletion.
- Formal review moderation tooling.
- Automated consent and suppression dashboard.
- Commerce-specific terms, returns, recalls, tax, and fulfilment policies when product sales become live.
