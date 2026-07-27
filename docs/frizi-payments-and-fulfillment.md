# Frizi Payments And Fulfillment MVP

## Revenue Model

- Professional subscription: `29.00 CAD` per month through Stripe Billing.
- In-app service payments: client pays Frizi checkout, Stripe Connect routes the professional payout, and Frizi collects a `4.5%` application fee.
- In-app product payments: client buys from Frizi, Frizi records product margin and stylist commission, then fulfills through an approved supplier.
- Optional instant payout: shown as an upsell to eligible professionals with an additional `2%` fee.

## Stripe Setup

Required Vercel environment variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRIZI_PUBLIC_APP_URL=https://frizi.ca`
- `FRIZI_PRO_MONTHLY_PRICE_ID`
- `FRIZI_PLATFORM_FEE_RATE=0.045`
- `FRIZI_INSTANT_PAYOUT_FEE_RATE=0.02`

Client app API routes:

- `POST /api/create-checkout-session`
- `POST /api/stripe-webhook`

MVP checkout payload examples:

```json
{
  "kind": "service_booking",
  "amountCents": 11500,
  "currency": "cad",
  "connectedAccountId": "acct_connected_professional",
  "customerEmail": "client@example.com",
  "professionalName": "Mara Chen"
}
```

```json
{
  "kind": "product_purchase",
  "amountCents": 4300,
  "currency": "cad",
  "productName": "Living Proof Full Dry Volume & Texture Spray",
  "stylistCommissionCents": 250
}
```

## Fulfillment Process

1. Client buys the product in Frizi checkout.
2. Stripe confirms payment through `checkout.session.completed`.
3. Frizi creates an internal order with client shipping details, selected SKU, retail price, internal cost, stylist commission, and fulfillment method.
4. Admin reviews the order and places supplier fulfillment manually for MVP.
5. Supplier ships blind or with Frizi-branded/customer-safe packing where the supplier supports it.
6. Frizi sends the client tracking and support updates.
7. Weekly payout run reconciles service earnings and product commissions for the professional.

## Supplier Rules

- Prefer wholesale or distributor accounts that allow resale and blind fulfillment.
- For Amazon-based fulfillment, use Amazon MCF or policies that allow Frizi to remain seller of record.
- Do not expose Amazon checkout to the client if Frizi wants to own the product sale and collect in-app revenue.
- Keep supplier URL, cost, SKU, margin, and fulfillment notes in the admin portal only.

## Starter Product Categories

- Styling powder for fades, short cuts, and fine hair.
- Texture spray and volume spray for fine hair and blowouts.
- Dry shampoo for color, blowout, and wash-day extension.
- Curl cream and defining products for curl-cut follow-up.
- Frizz and humidity spray for seasonal promos.
- Pomade or texture paste for barber services.
