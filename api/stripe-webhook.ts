import Stripe from 'stripe';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const config = {
  api: {
    bodyParser: false,
  },
};

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readRawBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return sendJson(response, 501, { error: 'Stripe webhook is not configured yet.' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-06-24.dahlia',
  });
  const signature = request.headers['stripe-signature'];
  const rawBody = await readRawBody(request);

  if (typeof signature !== 'string') {
    return sendJson(response, 400, { error: 'Missing Stripe signature.' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid webhook signature.' });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.info('[frizi-payments] checkout completed', {
        id: session.id,
        kind: session.metadata?.frizi_checkout_kind,
        professional: session.metadata?.professional_name,
        serviceAmountCents: session.metadata?.service_amount_cents,
        taxCents: session.metadata?.tax_cents,
        tipCents: session.metadata?.tip_cents,
        revenueExcludingTipsCents: session.metadata?.revenue_excluding_tips_cents,
        revenueIncludingTipsCents: session.metadata?.revenue_including_tips_cents,
      });
      break;
    }
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed':
    case 'charge.refunded':
    case 'customer.subscription.created':
    case 'customer.subscription.deleted': {
      console.info('[frizi-payments] stripe event', event.type);
      break;
    }
    default:
      console.info('[frizi-payments] unhandled stripe event', event.type);
  }

  return sendJson(response, 200, { received: true });
}
