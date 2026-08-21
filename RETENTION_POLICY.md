# Frizi Retention Policy Draft

Status: OWNER/LEGAL DECISION REQUIRED before commercial launch.

| Data | Proposed retention | Current status |
| --- | --- | --- |
| Auth records | active account plus security/accounting retention | Supabase-managed; deletion workflow not finalized |
| Client/professional profiles | active account, then delete/anonymize after approved request unless required | not automated |
| Photos/media | active use; delete on user request where lawful | storage deletion paths partially implemented |
| Appointments | retain for service, dispute, tax/payment record windows | no formal retention job |
| CRM notes/messages | retain while relationship/account active, delete/anonymize on approved request | no formal retention job |
| Reviews | retain while public/approved, support takedown/moderation | moderation process manual |
| Invite/passport tokens | active until revoked/expired; keep minimal audit trail | rotate/revoke present for some flows |
| Marketing consent/suppression | retain suppression/withdrawal records as long as needed to comply | suppression workflow incomplete |
| Stripe/payment records | retain per tax/accounting/legal obligations | Stripe and Supabase records need policy |
| Webhook/audit logs | retain enough for reconciliation/security, minimize payloads | payload minimization recommended |
| Backups | provider-defined retention | confirm Supabase/Vercel plan |

Backups cannot be promised as immediately purged unless provider controls and plan support it.

## Limited Launch Manual Workflow

Before automated jobs exist:

- Deletion requests are triaged by the owner and checked for tax/accounting/dispute retention needs.
- Export requests are fulfilled from Supabase tables and storage object inventories after identity verification.
- Passport and invite revocation requests are fulfilled by expiring/rotating token rows.
- Marketing withdrawal is fulfilled by updating relationship/campaign consent state and preserving suppression records.
- Photo deletion requests must remove both metadata rows and storage objects where lawful.
- Completed request IDs, operator, date, affected records, and retained exceptions should be logged outside the customer-visible app.
