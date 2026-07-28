# Frizi Commerce Foundation

## Existing Architecture Found

- The main Frizi app had appointment booking, client profile, saved professionals, a static Products tab, policy/help copy, Stripe appointment Checkout, dynamic appointment pricing, promotions, tips, and a Stripe webhook.
- There were no durable product catalogue, supplier listing, cart, order, shipping, fulfilment, return, recall, or product commission APIs in this repository.
- `/api/create-checkout-session` already supported appointment payments and now branches product checkout separately.
- Product commerce is intentionally not merged into appointment checkout because physical products need shipping, tax, returns, recalls, inventory, and commission records that differ from services and tips.

## Architecture Chosen

Frizi Commerce is a separate product-order flow:

1. Admin catalogue creates or imports products in draft/review states.
2. A sellable variant is approved for Canadian sale only after compliance, supplier, label, claims, inventory, and shipping checks.
3. A professional recommends an exact variant to a client.
4. The client adds approved products to a Frizi cart.
5. The server recalculates price, promotion, shipping, tax, and commission attribution.
6. Stripe Checkout uses dynamic `price_data`; no permanent Stripe Price is created for each product/cart/promo/shipping amount.
7. Stripe webhook confirmation moves the order into manual fulfilment and commission pending states.

## Implemented Demo Data

The server module `api/_frizi-commerce.mjs` contains demo authoritative records until Supabase is connected:

- Master products
- Variants
- Brands
- Suppliers
- Supplier listings
- Professional product recommendations
- Product promotions
- Province tax configuration
- Manual package and flat-rate shipping configuration

Demo products include both approved and blocked products so the UI can demonstrate Canadian-sale gating.

## Product And Variant Model

Master product identity is separated from sellable variants. Variants contain SKU, size, weight, dimensions, price, cost, inventory mode, shipping restrictions, and return policy.

Products classified as drugs, natural health products, medical devices, professional-use-only, restricted, or unknown/unreviewed are blocked by default.

Only products and variants with `approved_for_canadian_sale`, Canadian authorization flags, bilingual label confirmation, and an approved supplier listing can be purchased.

## Supplier Model

Supplier listings are separate from products. A supplier must be active and allow online resale before a variant is purchasable. Supplier cost, inventory confidence, lead time, dropship capability, and authorization status are internal only.

## Recommendation And Attribution Model

Recommendations attach:

- customer
- professional
- salon
- appointment
- product variant
- recommendation reason
- usage instruction
- commission rate and rule version

Commission calculations use net merchandise revenue after product discounts, excluding shipping and tax.

## Cart And Checkout

Routes:

- `GET /api/commerce-catalog`
- `POST /api/commerce-cart-summary`
- `POST /api/create-checkout-session` with `kind: "product_purchase"`

The browser sends variant IDs, quantities, recommendation IDs, promo code, province, and postal code. It does not send trusted prices, discounts, shipping, tax, commission, or totals.

Checkout remains disabled unless `COMMERCE_CHECKOUT_ENABLED=true`.

## Promotions

Product promotions are separate from appointment promotions and shipping promotions. The demo includes:

- `PRODUCT10`: 10% off product merchandise over $30, capped at $15
- automatic free shipping over $75

Appointment-only promotions do not discount products, shipping, or tips.

## Tax

The demo uses reviewed-fixture-style province tax basis points in server code, but this is not production tax advice. Production must use reviewed Canadian tax configuration or a verified tax provider. Tax is calculated on net merchandise plus shipping where configured in this demo.

## Shipping

The first shipping layer is provider-neutral with:

- manual flat-rate shipping
- remote postal-code surcharge
- package selection by total weight
- quote expiry
- Canada Post test flag placeholder

Canada Post live/test credentials are not configured in this repository. No label is purchased automatically.

## Manual Fulfilment

Webhook metadata marks paid product orders ready for manual fulfilment with:

- order status `paid`
- fulfilment status `awaiting_purchase`
- commission status `pending_return_window`

The migration includes shipment, return, recall, safety incident, and audit tables for the admin workflow.

## Feature Flags

Risky features default disabled:

- `COMMERCE_CHECKOUT_ENABLED`
- `COMMERCE_LIVE_PAYMENTS_ENABLED`
- `COMMERCE_CANADA_POST_ENABLED`
- `COMMERCE_AUTOMATED_FULFILMENT_ENABLED`
- `COMMERCE_PRO_PAYOUTS_ENABLED`

## Required Environment Variables

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRIZI_PUBLIC_APP_URL`
- `COMMERCE_CHECKOUT_ENABLED=true` for test checkout
- `COMMERCE_CANADA_POST_ENABLED=true` only after test credentials exist

Optional future variables:

- `CANADA_POST_TEST_USERNAME`
- `CANADA_POST_TEST_PASSWORD`
- `CANADA_POST_TEST_CUSTOMER_NUMBER`
- `FRIZI_COMMERCE_QUOTE_TTL_MINUTES`

## Remaining Reviews Before Launch

Final review is required from qualified Canadian legal, regulatory, accounting, product-safety, supplier, privacy, and operations professionals for:

- cosmetic classification and notification responsibility
- labels and bilingual packaging
- ingredients and claims
- supplier authorization and online resale permission
- tax registration, collection, and filing
- consumer disclosures, return rights, and refund policies
- privacy consent and CASL marketing rules
- recall and incident-response notices
- payout/commission tax handling

## Still Incomplete

- Supabase migration is added but not applied.
- Demo data is API-local until database records are connected.
- Stripe product checkout is disabled until environment variables are added.
- Webhook logs fulfilment intent but does not persist orders yet.
- Canada Post is a connector-ready placeholder, not a live integration.
- Admin dashboard screens are not fully built.
- Returns, refunds, safety incidents, and recalls have schema but no complete UI workflow yet.
