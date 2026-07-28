# Frizi Dynamic Appointment Pricing

## Existing Architecture Found

- Client services and prices were stored in `src/App.tsx` professional fixtures.
- `BookingConfirmation` calculated taxes, tips, and totals in the browser.
- `/api/create-checkout-session` already used Stripe Checkout dynamic `price_data`, but accepted browser-supplied service, tax, tip, and total amounts.
- `/api/stripe-webhook` verified Stripe signatures and logged events, but did not finalize durable payment records.
- `supabase/migrations/20260727162000_add_tip_accounting.sql` added a payment ledger with separate tip columns.
- No live database client is configured in this repo yet, so this implementation uses API-local demo records as the authoritative test data until Supabase is wired.

## Dynamic Pricing Implementation

`api/_frizi-pricing.mjs` is the single calculation path used by:

- `POST /api/checkout-summary`
- `POST /api/create-checkout-session`

The browser sends identifiers and selections only:

- `appointmentId`
- `professionalId`
- `customerId`
- `selectedServiceIds`
- `promoCode`
- `tipSelection`
- `customTipAmount`

The server reloads trusted demo records for professional, salon, services, promotions, appointment history, deposit credits, and redemptions, then calculates:

- service subtotal
- promotion eligibility
- discount
- discounted service subtotal
- tax
- deposit credit
- optional tip
- amount due now

Stripe Checkout uses `mode: payment` and dynamic `line_items` with `price_data`; no permanent Stripe Prices are created for appointment variations.

## Promotion Rules

Frizi promotions are primary. Stripe Promotion Codes are not required for Frizi-created appointment offers.

Default behavior:

- One appointment-level promotion applies unless a promotion is explicitly combinable.
- Discounts do not apply to tax.
- Discounts do not apply to tips.
- First-cut discounts do not apply to retail products.
- Discounts cannot create a negative subtotal.
- A zero-dollar order returns a no-cost completion response instead of creating an invalid Stripe Checkout Session.

## First-Cut Definition

The implemented `25% off your first cut` test promotion applies only when the customer has no qualifying completed, paid, non-refunded appointment with the applicable professional or salon scope.

Cancelled, declined, no-show, unpaid, and refunded appointments do not count as qualifying completed appointments in the demo records.

Final redemption should be committed from `checkout.session.completed`. Opened and abandoned Checkout Sessions should not finalize redemptions.

## Tip Rule

Suggested percentage tips are calculated on the original eligible service subtotal before promotional discounts and before tax. Tips are:

- included in the same Stripe Checkout payment
- separate from service revenue in metadata and payment schema
- never discounted
- validated server-side
- capped by `FRIZI_MAX_CUSTOM_TIP_CENTS`, default `20000`

## Tax Rule

The current demo uses CAD and `FRIZI_TAX_RATE_BPS`, default `1300` for 13%. Tax is calculated on discounted taxable service subtotal. Tips are not taxed in this demo rule.

## Deposit Handling

Paid deposits are credited once against discounted service subtotal plus tax. Suggested tips still use the full eligible service subtotal, not the remaining balance.

## Stripe Metadata

Checkout Session and PaymentIntent metadata include:

- `appointment_id`
- `customer_id`
- `stylist_id`
- `salon_id`
- `promotion_id`
- `promotion_redemption_id`
- `tip_amount`
- `service_subtotal`
- `discount_amount`
- `tax_amount`
- `deposit_credit`
- `amount_due`
- `currency`
- `pricing_version`
- `pricing_snapshot_hash`

No sensitive hair-profile details are placed in Stripe metadata.

## Webhook Events

`api/stripe-webhook.ts` handles:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `refund.updated`

The current implementation uses an in-memory event-id set for local/serverless demo idempotency. Production should persist event ids in a database table.

## Database Migration

`supabase/migrations/20260727200000_dynamic_appointment_pricing.sql` adds:

- `frizi_services`
- `frizi_service_price_overrides`
- `frizi_promotions`
- `frizi_promotion_redemptions`
- `frizi_payment_snapshots`
- `frizi_deposit_payments`

It also extends `payment_records` with promotion, discount, deposit, snapshot, method, and source columns.

## Automated Tests

`npm test` covers:

- first-cut percentage discount
- returning customer ineligibility
- expired promotion
- inactive promotion
- fixed discount minimum subtotal
- custom tip validation
- deposit credit
- duplicate redemption prevention

## Manual Stripe Sandbox Test

1. Set Vercel/local test env vars:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `FRIZI_PUBLIC_APP_URL`
   - optional `STRIPE_TEST_CONNECTED_ACCOUNT_ID`
2. Open `frizi.ca`.
3. Search for a stylist.
4. Click `Book an appointment`.
5. Choose a service and time.
6. Review server-calculated checkout summary.
7. Optionally enter `FIRSTCUT25`, `FRIZI10`, `EXPIRED`, or `INACTIVE`.
8. Choose 15%, 18%, 20%, 25%, custom, or no tip.
9. Click `Continue to secure payment`.
10. Complete Stripe test Checkout.
11. Confirm `checkout.session.completed` reaches `/api/stripe-webhook`.

## Remaining Production Work

- Wire `api/_frizi-pricing.mjs` loaders to Supabase instead of demo records.
- Persist payment snapshots before Stripe Checkout creation.
- Persist webhook event ids for durable idempotency.
- Persist promotion redemption reservation/release/redeem state.
- Persist payment records, tip records, receipts, appointment status, and refunds from webhooks.
- Add admin promotion management UI backed by the new `frizi_promotions` table.
- Add full refund allocation APIs for service, tax, tip, and deposit components.
