import Stripe from 'stripe';
import type { IncomingMessage, ServerResponse } from 'node:http';

type CheckoutKind = 'pro_subscription' | 'service_booking' | 'product_purchase';

type CheckoutRequest = {
  kind?: CheckoutKind;
  amountCents?: number;
  currency?: string;
  connectedAccountId?: string;
  customerEmail?: string;
  productName?: string;
  professionalName?: string;
  stylistCommissionCents?: number;
};

const platformFeeRate = Number(process.env.FRIZI_PLATFORM_FEE_RATE || '0.045');
const instantPayoutFeeRate = Number(process.env.FRIZI_INSTANT_PAYOUT_FEE_RATE || '0.02');

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

function getBaseUrl(request: IncomingMessage) {
  const host = request.headers.host;
  return process.env.FRIZI_PUBLIC_APP_URL || (host ? `https://${host}` : 'https://frizi.ca');
}

async function readJson(request: IncomingMessage & { body?: unknown }): Promise<CheckoutRequest> {
  if (request.body && typeof request.body === 'object') {
    return request.body as CheckoutRequest;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? (JSON.parse(rawBody) as CheckoutRequest) : {};
}

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return sendJson(response, 501, {
      error: 'Stripe is not configured yet.',
      requiredEnv: [
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'FRIZI_PUBLIC_APP_URL',
        'FRIZI_PRO_MONTHLY_PRICE_ID',
      ],
    });
  }

  const payload = await readJson(request);
  const kind = payload.kind || 'service_booking';
  const amountCents = Math.max(100, Math.round(payload.amountCents || 11500));
  const currency = (payload.currency || 'cad').toLowerCase();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-06-24.dahlia',
  });
  const baseUrl = getBaseUrl(request);

  const metadata = {
    frizi_checkout_kind: kind,
    professional_name: payload.professionalName || 'Mara Chen',
    platform_fee_rate: platformFeeRate.toString(),
    instant_payout_fee_rate: instantPayoutFeeRate.toString(),
    stylist_commission_cents: String(payload.stylistCommissionCents || 0),
  };

  const lineItem =
    kind === 'pro_subscription' && process.env.FRIZI_PRO_MONTHLY_PRICE_ID
      ? { price: process.env.FRIZI_PRO_MONTHLY_PRICE_ID, quantity: 1 }
      : {
          price_data: {
            currency,
            product_data: {
              name:
                payload.productName ||
                (kind === 'product_purchase' ? 'Frizi professional product order' : 'Frizi appointment payment'),
            },
            recurring: kind === 'pro_subscription' ? { interval: 'month' as const } : undefined,
            unit_amount: kind === 'pro_subscription' ? 2900 : amountCents,
          },
          quantity: 1,
        };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: kind === 'pro_subscription' ? 'subscription' : 'payment',
    customer_email: payload.customerEmail,
    line_items: [lineItem],
    success_url: `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/?checkout=cancelled`,
    metadata,
  };

  if (kind === 'service_booking' && payload.connectedAccountId) {
    sessionParams.payment_intent_data = {
      application_fee_amount: Math.round(amountCents * platformFeeRate),
      transfer_data: {
        destination: payload.connectedAccountId,
      },
      metadata,
    };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return sendJson(response, 200, { url: session.url, id: session.id });
}
